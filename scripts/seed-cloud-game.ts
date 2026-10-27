import { parseArgs } from "node:util";
import { randomInt, createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { readManifest, personSchema } from "../server/content.js";
import { supabaseAdmin } from "../server/supabase-client.js";
import { syncCategoryDefinitions } from "./import/categories.js";
const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

async function main() {
  const { values } = parseArgs({
    options: {
      day: { type: "string", default: new Date().toISOString().slice(0, 10) },
    },
  });
  const day = values.day!;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  )
    throw new Error("Use --day YYYY-MM-DD (UTC).");
  const admin = supabaseAdmin();
  await admin.request("/rest/v1/blurrle_playable_people?select=id&limit=1");
  await syncCategoryDefinitions(admin);
  const bucket = process.env.SUPABASE_PORTRAIT_BUCKET || "portrait-imports";
  const info = await admin.request<{ public: boolean }>(
    `/storage/v1/bucket/${bucket}`,
  );
  if (info.public) throw new Error("Use the private portrait-imports bucket.");
  const extras = personSchema
    .array()
    .parse(JSON.parse(await readFile("data/extra-people.json", "utf8")));
  const people = [...readManifest(), ...extras];
  const portraits = new Map<string, string>();
  await mkdir("var/curated", { recursive: true });
  for (const person of people) {
    const local = existsSync(`data/images/${person.imagePath}`)
      ? `data/images/${person.imagePath}`
      : `var/curated/${person.imagePath}`;
    if (!existsSync(local)) {
      const response = await fetch(person.sourceAssetUrl, {
        headers: {
          "User-Agent":
            "BlurrlePrototype/0.1 (curated portraits; attribution retained)",
        },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok)
        throw new Error(
          `Portrait download failed for ${person.name} (HTTP ${response.status}).`,
        );
      let original = await sharp(Buffer.from(await response.arrayBuffer()))
        .rotate()
        .toBuffer();
      if (person.cropBottomFraction) {
        const dimensions = await sharp(original).metadata();
        original = await sharp(original)
          .extract({
            left: 0,
            top: 0,
            width: dimensions.width!,
            height: Math.floor(
              dimensions.height! * (1 - person.cropBottomFraction),
            ),
          })
          .toBuffer();
      }
      await sharp(original)
        .resize({
          width: 1000,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 86 })
        .toFile(local);
    }
    const bytes = await readFile(local);
    const metadata = await sharp(bytes).metadata();
    const sha256 = hash(bytes);
    const id = hash(`blurrle-curated-v1:${person.imagePath}`).slice(0, 24);
    const storagePath = `curated-v1/${sha256}.webp`;
    await admin.request(
      `/storage/v1/object/${bucket}/${storagePath}`,
      {
        method: "POST",
        headers: { "Content-Type": "image/webp", "x-upsert": "false" },
        body: new Uint8Array(bytes),
      },
      [409],
    );
    await admin.request("/rest/v1/rpc/import_blurrle_portrait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person: {
          id: person.id,
          name: person.name,
          accepted_answers: [...new Set([person.name, ...person.aliases])],
          hint: person.hint,
        },
        memberships: person.categories,
        portrait: {
          id,
          storage_bucket: bucket,
          storage_path: storagePath,
          source_dataset: "blurrle-curated-v1",
          source_dataset_url: person.sourcePageUrl,
          source_file: person.imagePath,
          source_label: person.name,
          dataset_license_name: person.licenseName,
          dataset_license_url: person.licenseUrl,
          sha256,
          width: metadata.width,
          height: metadata.height,
          source_metadata: {
            creator: person.creator,
            cropBottomFraction: person.cropBottomFraction ?? 0,
            sourceAssetUrl: person.sourceAssetUrl,
            changes:
              "Resized and converted to WebP; cropped and temporarily blurred during gameplay.",
          },
        },
      }),
    });
    await admin.request(`/rest/v1/people?id=eq.${person.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: person.name,
        accepted_answers: [...new Set([person.name, ...person.aliases])],
        hint: person.hint,
      }),
    });
    await admin.request(`/rest/v1/portraits?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        review_status: "approved",
        image_source_url: person.sourcePageUrl,
        image_license_name: person.licenseName,
        image_license_url: person.licenseUrl,
        attribution: person.attribution,
      }),
    });
    portraits.set(person.id, id);
    console.log(`Curated: ${person.name}`);
  }
  const path = `/rest/v1/daily_images?day=eq.${day}&category_slug=eq.actors&select=person_id,portrait_id,position&order=position`;
  let selected =
    await admin.request<
      { person_id: string; portrait_id: string; position: number }[]
    >(path);
  if (!selected.length) {
    const names = [
      "Leonardo DiCaprio",
      "Keanu Reeves",
      "Aaron Paul",
      "Emma Watson",
      "Bryan Cranston",
    ];
    const starter = names.map((name) =>
      people.find((person) => person.name === name)!,
    );
    for (let i = starter.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [starter[i], starter[j]] = [starter[j], starter[i]];
    }
    await admin.request(
      "/rest/v1/daily_images",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(
          starter.map((person, position) => ({
            day,
            category_slug: "actors",
            position,
            person_id: person.id,
            portrait_id: portraits.get(person.id),
          })),
        ),
      },
      [409],
    );
    selected = await admin.request(path);
  }
  if (selected.length !== 5)
    throw new Error(
      "Existing Actors daily selection is incomplete; it was not replaced.",
    );
  // Approve profiles only after the starter rows exist, so API generation cannot
  // race ahead and select a different initial Actors set during this seed.
  await admin.request(
    `/rest/v1/people?id=in.(${people.map((person) => person.id).join(",")})`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ review_status: "approved" }),
    },
  );
  console.log(
    "Actors daily set:",
    selected.map(
      (row) =>
        people.find((person) => person.id === row.person_id)?.name ??
        row.person_id,
    ),
  );
  console.log(
    "Other daily sets:",
    await admin.request("/rest/v1/rpc/generate_blurrle_daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_day: day }),
    }),
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Cloud seed failed.");
  process.exitCode = 1;
});
