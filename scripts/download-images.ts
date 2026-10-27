import { mkdir, rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { readManifest } from "../server/content.js";
const concurrency = Math.min(
  6,
  Math.max(1, Number(process.env.IMAGE_DOWNLOAD_CONCURRENCY) || 4),
);
const people = readManifest();
const began = performance.now();
let downloaded = 0,
  cached = 0,
  cursor = 0;
const failures: string[] = [];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir("data/images", { recursive: true });
async function download(person: (typeof people)[number]) {
  const destination = `data/images/${person.imagePath}`;
  if (existsSync(destination)) {
    try {
      await sharp(destination).stats();
      cached++;
      console.log(`Cached: ${person.name}`);
      return;
    } catch {
      /* Replace corrupt assets. */
    }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    let retryMs = 1000 * 2 ** attempt;
    try {
      const response = await fetch(person.sourceAssetUrl, {
        headers: {
          "User-Agent":
            "BlurrlePrototype/0.1 (local game; Wikimedia attribution preserved)",
        },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          retryMs = Math.max(
            retryMs,
            Number.isFinite(seconds)
              ? seconds * 1000
              : Date.parse(retryAfter) - Date.now(),
          );
        }
        await response.body?.cancel();
        if (
          response.status >= 400 &&
          response.status < 500 &&
          ![408, 429].includes(response.status)
        )
          throw new PermanentDownloadError(`HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await sharp(bytes)
        .rotate()
        .resize({
          width: 1000,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 86 })
        .toFile(`${destination}.tmp`);
      await rename(`${destination}.tmp`, destination);
      downloaded++;
      console.log(`Downloaded: ${person.name}`);
      return;
    } catch (error) {
      await unlink(`${destination}.tmp`).catch(() => {});
      if (error instanceof PermanentDownloadError || attempt === 3) throw error;
      console.log(`Retrying ${person.name} in ${Math.ceil(retryMs / 1000)}s`);
      await wait(Math.max(0, retryMs));
    }
  }
}
class PermanentDownloadError extends Error {}
async function worker() {
  while (cursor < people.length) {
    const person = people[cursor++];
    try {
      await download(person);
    } catch (error) {
      failures.push(`${person.name}: ${String(error)}`);
    }
  }
}
console.log(
  `Checking ${people.length} portraits; up to ${concurrency} parallel downloads.`,
);
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(
  `${downloaded} downloaded, ${cached} cached in ${((performance.now() - began) / 1000).toFixed(1)}s.`,
);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
