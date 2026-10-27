import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { fromBuffer, type ZipFile } from "yauzl";
import { parse } from "csv-parse/sync";
import { suggestCategories } from "./categories.js";
import { readManifest } from "../../server/content.js";

export const dataset = {
  id: "kaggle-souvenger-celebrity-faces-v1",
  url: "https://www.kaggle.com/datasets/souvenger/celebrity-faces-dataset",
  download:
    "https://www.kaggle.com/api/v1/datasets/download/souvenger/celebrity-faces-dataset?datasetVersionNumber=1",
  sha256: "63d1da6a330ec9f69f8a4e24715fb9af5fdcd7e494efb4ccae2437d1c0667f32",
  license: "Community Data License Agreement - Permissive - Version 1.0",
  licenseUrl: "https://cdla.dev/permissive-1-0/",
};
export const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const nameKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

export async function loadArchive(path: string) {
  let exists = false;
  try {
    exists = (await stat(path)).isFile();
  } catch {
    /* Download the pinned source below. */
  }
  if (!exists) {
    await mkdir(dirname(path), { recursive: true });
    console.log("Downloading the pinned Kaggle archive (~36 MB)…");
    const response = await fetch(dataset.download, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok)
      throw new Error(
        `Kaggle download failed (HTTP ${response.status}). Use --archive with a downloaded ZIP.`,
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024 || digest(bytes) !== dataset.sha256)
      throw new Error(
        "Kaggle archive differs from the inspected version. Inspect the source before updating its checksum.",
      );
    await writeFile(`${path}.tmp`, bytes);
    await rename(`${path}.tmp`, path);
  }
  if ((await stat(path)).size > 100 * 1024 * 1024)
    throw new Error("Archive exceeds the 100 MB import limit.");
  const bytes = await readFile(path);
  if (digest(bytes) !== dataset.sha256)
    throw new Error(
      "Archive checksum does not match the inspected Kaggle version 1.",
    );
  let total = 0;
  const files: Record<string, Uint8Array> = {};
  const zip = await new Promise<ZipFile>((resolve, reject) => {
    fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true },
      (error, archive) => {
        if (error || !archive)
          reject(error ?? new Error("Invalid ZIP archive."));
        else resolve(archive);
      },
    );
  });
  await new Promise<void>((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", async (entry) => {
      try {
        if (!/\.(csv|jpe?g|png|webp)$/i.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        total += entry.uncompressedSize;
        if (
          entry.uncompressedSize > 16 * 1024 * 1024 ||
          total > 300 * 1024 * 1024
        )
          throw new Error("Archive exceeds the supported uncompressed size.");
        const stream = await new Promise<import("node:stream").Readable>(
          (done, fail) => {
            zip.openReadStream(entry, (error, stream) => {
              if (error || !stream)
                fail(error ?? new Error("Unreadable ZIP entry."));
              else done(stream);
            });
          },
        );
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > 16 * 1024 * 1024)
            throw new Error("ZIP entry exceeds the supported size.");
          chunks.push(chunk);
        }
        if (files[entry.fileName]) throw new Error("Duplicate ZIP entry.");
        files[entry.fileName] = Buffer.concat(chunks);
        zip.readEntry();
      } catch (error) {
        zip.close();
        reject(error);
      }
    });
    zip.readEntry();
  });
  const labelFiles = Object.keys(files).filter(
    (name) => basename(name).toLowerCase() === "labels.csv",
  );
  if (labelFiles.length !== 1)
    throw new Error("Expected one Labels.csv in the Kaggle archive.");
  const rows = parse(Buffer.from(files[labelFiles[0]]), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  const images = Object.keys(files).filter((name) =>
    /\.(jpe?g|png|webp)$/i.test(name),
  );
  const byLabel = new Map<string, string>();
  for (const path of images) {
    const key = basename(path, extname(path)).toLowerCase();
    if (byLabel.has(key))
      throw new Error(`Duplicate image label in archive: ${key}`);
    byLabel.set(key, path);
  }
  const seedNames = new Map(
    readManifest().flatMap((person) =>
      [person.name, ...person.aliases].map(
        (name) => [nameKey(name), person] as const,
      ),
    ),
  );
  const seen = new Set<string>();
  const unmatched: string[] = [];
  const entries = rows.flatMap((row) => {
    const key = row.SamAccountName?.trim().toLowerCase();
    const sourceFile = byLabel.get(key);
    const name = `${row.Givenname ?? ""} ${row.Surname ?? ""}`
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/^"+|"+$/gu, "")
      .trim();
    if (!key || !name || !sourceFile) {
      unmatched.push(key || "invalid label row");
      return [];
    }
    if (seen.has(key)) throw new Error(`Duplicate CSV label: ${key}`);
    seen.add(key);
    const seed = seedNames.get(nameKey(name));
    const person = seed
      ? {
          id: seed.id,
          name: seed.name,
          accepted_answers: [...new Set([seed.name, ...seed.aliases])],
          hint: seed.hint,
        }
      : {
          id: digest(`blurrle-person:${nameKey(name)}`).slice(0, 12),
          name,
          accepted_answers: [name],
          hint: null,
        };
    return [
      {
        sourceFile,
        sourceLabel: name,
        row,
        person,
        categories: [
          ...new Set([...(seed?.categories ?? []), ...suggestCategories(name)]),
        ],
        bytes: files[sourceFile],
      },
    ];
  });
  return {
    entries,
    imageCount: images.length,
    labelCount: rows.length,
    unmatchedLabels: unmatched,
    unlabeledImages: images.filter(
      (path) => !seen.has(basename(path, extname(path)).toLowerCase()),
    ),
  };
}
