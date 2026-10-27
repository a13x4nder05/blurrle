import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { supabaseAdmin } from "../server/supabase-client.js";

type Person = {
  id: string;
  name: string;
  hint: string | null;
  accepted_answers: string[];
  review_status: string;
};
type Portrait = {
  id: string;
  person_id: string;
  source_metadata: Record<string, unknown>;
  review_status: string;
};
async function main() {
  const { values } = parseArgs({
    options: { apply: { type: "boolean", default: false } },
  });
  const manifest = z
    .object({
      reviewedAt: z.string(),
      personIds: z.array(z.string()).min(1),
      portraitIds: z.array(z.string()).min(1),
    })
    .parse(JSON.parse(await readFile("data/catalog-review.json", "utf8")));
  const hints = z
    .record(z.string(), z.string().min(1))
    .parse(JSON.parse(await readFile("data/catalog-hints.json", "utf8")));
  const corrections = z
    .record(
      z.string(),
      z.object({ name: z.string(), aliases: z.array(z.string()) }),
    )
    .parse(
      JSON.parse(await readFile("data/catalog-name-corrections.json", "utf8")),
    );
  const byName = new Map(
    Object.entries(corrections).flatMap(([oldName, correction]) => [
      [oldName, correction] as const,
      [correction.name, correction] as const,
    ]),
  );
  const allHints = new Map(
    Object.entries(hints).flatMap(([name, hint]) => [
      [name, hint] as const,
      [corrections[name]?.name ?? name, hint] as const,
    ]),
  );
  const admin = supabaseAdmin();
  const [allPeople, allPhotos] = await Promise.all([
    admin.request<Person[]>(
      "/rest/v1/people?select=id,name,hint,accepted_answers,review_status&limit=1000",
    ),
    admin.request<Portrait[]>(
      "/rest/v1/portraits?select=id,person_id,source_metadata,review_status&limit=1000",
    ),
  ]);
  const people = allPeople.filter((person) =>
    manifest.personIds.includes(person.id),
  );
  const photos = allPhotos.filter((photo) =>
    manifest.portraitIds.includes(photo.id),
  );
  if (
    people.length !== manifest.personIds.length ||
    photos.length !== manifest.portraitIds.length
  )
    throw new Error(
      "A reviewed record is missing. Review the manifest before continuing.",
    );
  const missing = people.filter(
    (person) => !person.hint?.trim() && !allHints.has(person.name),
  );
  if (missing.length)
    throw new Error(
      `Missing authored hints: ${missing.map((person) => person.name).join(", ")}`,
    );
  console.log(
    `Reviewed scope: ${people.length} people, ${photos.length} portraits. Missing hints: ${people.filter((person) => !person.hint?.trim()).length}.`,
  );
  if (!values.apply) {
    console.log(
      "Dry run only. Use --apply to record the owner's review. Future imports are not included.",
    );
    return;
  }
  await mkdir("var/catalog-review", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(
    `var/catalog-review/${stamp}-before.json`,
    JSON.stringify({ people, photos }, null, 2),
  );
  const failures: string[] = [];
  let cursor = 0,
    completed = 0;
  async function worker() {
    while (cursor < people.length) {
      const person = people[cursor++];
      const correction = byName.get(person.name);
      try {
        const rows = await admin.request<Person[]>(
          `/rest/v1/people?id=eq.${person.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              name: correction?.name ?? person.name,
              accepted_answers: [
                ...new Set([
                  ...person.accepted_answers,
                  person.name,
                  correction?.name ?? person.name,
                  ...(correction?.aliases ?? []),
                ]),
              ],
              hint: person.hint?.trim() || allHints.get(person.name),
              review_status: "approved",
            }),
          },
        );
        if (rows.length !== 1) throw new Error("Record was not updated.");
        completed++;
        if (completed % 25 === 0)
          console.log(`People reviewed: ${completed}/${people.length}`);
      } catch (error) {
        failures.push(
          `${person.name}: ${error instanceof Error ? error.message : "Update failed"}`,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  cursor = 0;
  completed = 0;
  async function photoWorker() {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      try {
        const rows = await admin.request<Portrait[]>(
          `/rest/v1/portraits?id=eq.${photo.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              review_status: "approved",
              source_metadata: {
                ...photo.source_metadata,
                owner_review: {
                  reviewed_at: manifest.reviewedAt,
                  reviewed_by: "project owner",
                  approved_for_game: true,
                  note: "Owner reviewed the current people catalog and requested gameplay approval. Original source and license fields are retained, not independently re-certified.",
                },
              },
            }),
          },
        );
        if (rows.length !== 1) throw new Error("Record was not updated.");
        completed++;
      } catch (error) {
        failures.push(
          `${photo.id}: ${error instanceof Error ? error.message : "Update failed"}`,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, photoWorker));
  await writeFile(
    `var/catalog-review/${stamp}-result.json`,
    JSON.stringify(
      { people: people.length, portraits: photos.length, failures },
      null,
      2,
    ),
  );
  if (failures.length)
    throw new Error(
      `${failures.length} updates failed; see the local review report. Re-running is safe.`,
    );
  const eligible = await admin.request<{ id: string; categories: string[] }[]>(
    "/rest/v1/blurrle_playable_people?select=id,categories&limit=1000",
  );
  const missingIds = manifest.personIds.filter(
    (id) => !eligible.some((person) => person.id === id),
  );
  if (missingIds.length)
    throw new Error(
      `${missingIds.length} reviewed people still excluded. Apply migration 202610270003_owner_reviewed_catalog.sql and rerun.`,
    );
  console.log(
    `All ${people.length} reviewed people are eligible. All ${photos.length} reviewed photos approved.`,
  );
  console.log(
    "Daily sets:",
    await admin.request("/rest/v1/rpc/generate_blurrle_daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Review failed.");
  process.exitCode = 1;
});
