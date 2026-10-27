import { parseArgs } from "node:util";
import { mkdir, writeFile, rename } from "node:fs/promises";
import sharp from "sharp";
import { dataset, digest, loadArchive } from "./import/kaggle.js";
import { syncCategoryDefinitions } from "./import/categories.js";
import { supabaseAdmin } from "./import/supabase.js";

async function main() {
  const { values } = parseArgs({
    options: {
      archive: {
        type: "string",
        default: "var/imports/celebrity-faces-v1.zip",
      },
      limit: { type: "string", default: "20" },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const limit = values.all ? Infinity : Number(values.limit);
  if (!(limit > 0 && (Number.isInteger(limit) || limit === Infinity)))
    throw new Error("--limit must be a positive integer, or use --all.");
  const source = await loadArchive(values.archive!);
  console.log(
    `Source: ${source.imageCount} images, ${source.labelCount} labels, ${source.entries.length} matched portraits.`,
  );
  if (source.unlabeledImages.length)
    console.log(`Unlabeled images skipped: ${source.unlabeledImages.length}`);
  if (source.unmatchedLabels.length)
    console.log(
      `Labels without usable images: ${source.unmatchedLabels.length}`,
    );
  const selected = source.entries.slice(0, limit);
  const dryRun = values["dry-run"];
  const bucket = process.env.SUPABASE_PORTRAIT_BUCKET || "portrait-imports";
  if (!/^[a-z0-9-]+$/.test(bucket))
    throw new Error("Invalid portrait bucket name.");
  const admin = dryRun ? null : supabaseAdmin();
  type Existing = {
    source_file: string;
    sha256: string;
    storage_bucket: string;
    storage_path: string;
    review_status: string;
  };
  const existing = new Map<string, Existing>();
  if (admin) {
    await syncCategoryDefinitions(admin);
    await admin.request("/rest/v1/people?select=id&limit=1");
    const info = await admin.request<{ public: boolean }>(
      `/storage/v1/bucket/${bucket}`,
    );
    if (info.public)
      throw new Error(
        "The import bucket must be private. Pending images are not ready for public gameplay.",
      );
    const rows = await admin.request<Existing[]>(
      `/rest/v1/portraits?source_dataset=eq.${dataset.id}&select=source_file,sha256,storage_bucket,storage_path,review_status&limit=1000`,
    );
    rows.forEach((row) => existing.set(row.source_file, row));
    console.log(
      `Supabase ready. ${rows.length} portraits already imported from this dataset.`,
    );
  }
  const report = {
    source: dataset.url,
    archiveSha256: dataset.sha256,
    dryRun,
    startedAt: new Date().toISOString(),
    unlabeledImages: source.unlabeledImages,
    unmatchedLabels: source.unmatchedLabels,
    imported: [] as {
      name: string;
      id: string;
      width: number;
      height: number;
    }[],
    skipped: [] as { name: string; reason: string }[],
    failed: [] as { name: string; reason: string }[],
  };
  const cache = "var/imports/prepared";
  await mkdir(cache, { recursive: true });
  const seenHashes = new Map<string, string>();
  for (const entry of selected) {
    try {
      const sha256 = digest(entry.bytes);
      const previous = existing.get(entry.sourceFile);
      if (previous) {
        if (previous.sha256 !== sha256)
          throw new Error("Source changed; manual review required.");
        // Preserve corrected names, review status, categories, and hints on reruns.
        report.skipped.push({
          name: entry.person.name,
          reason: "Already imported",
        });
        continue;
      }
      const duplicate = seenHashes.get(sha256);
      if (duplicate)
        throw new Error(
          `Duplicate image bytes shared with ${duplicate}; review the identity labels.`,
        );
      seenHashes.set(sha256, entry.person.name);
      const { data, info } = await sharp(entry.bytes, {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: 1000,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
      if (info.width < 128 || info.height < 128)
        throw new Error("Portrait is too small (minimum 128 pixels per side).");
      const id = digest(`${dataset.id}:${entry.sourceFile}`).slice(0, 24);
      const path = `${dataset.id}/${sha256}.webp`;
      await writeFile(`${cache}/${id}.webp`, data);
      if (admin) {
        // Content-addressed uploads never replace another object. A 409 after an
        // interrupted run means the previous upload is available for the RPC.
        await admin.request(
          `/storage/v1/object/${bucket}/${path}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "max-age=604800",
              "x-upsert": "false",
            },
            body: new Uint8Array(data),
          },
          [409],
        );
        await admin.request("/rest/v1/rpc/import_blurrle_portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person: entry.person,
            memberships: entry.categories,
            portrait: {
              id,
              storage_bucket: bucket,
              storage_path: path,
              source_dataset: dataset.id,
              source_dataset_url: dataset.url,
              source_file: entry.sourceFile,
              source_label: entry.sourceLabel,
              dataset_license_name: dataset.license,
              dataset_license_url: dataset.licenseUrl,
              sha256,
              width: info.width,
              height: info.height,
              source_metadata: {
                label: entry.row,
                dataset_version: 1,
                archive_sha256: dataset.sha256,
                note: "Uploader describes public-domain/social-media sources. Individual image licensing and identity require review; dataset license is recorded separately.",
              },
            },
          }),
        });
      }
      report.imported.push({
        name: entry.person.name,
        id,
        width: info.width,
        height: info.height,
      });
      console.log(
        `${dryRun ? "Prepared" : "Imported"}: ${entry.person.name} (${info.width}×${info.height})`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Import failed";
      report.failed.push({ name: entry.person.name, reason });
      console.error(`Failed: ${entry.person.name}: ${reason}`);
    }
  }
  const reportPath = `var/imports/${dryRun ? "dry-run" : "import"}-report.json`;
  await writeFile(`${reportPath}.tmp`, JSON.stringify(report, null, 2));
  await rename(`${reportPath}.tmp`, reportPath);
  console.log(
    `${dryRun ? "Prepared" : "Imported"} ${report.imported.length}; already present ${report.skipped.length}; failed ${report.failed.length}. Report: ${reportPath}`,
  );
  if (dryRun) console.log("Dry run: no Supabase requests or writes were made.");
  if (report.failed.length) process.exitCode = 1;
}
main().catch((error: unknown) => {
  // Do not log raw fetch errors, request headers, or environment values.
  console.error(error instanceof Error ? error.message : "Import failed.");
  process.exitCode = 1;
});
