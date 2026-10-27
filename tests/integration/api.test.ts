import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { openDb, migrate } from "../../server/db";
import { seed, readManifest } from "../../server/content";
import { createApp } from "../../server/app";
import { getDaily } from "../../server/daily";
const directory = mkdtempSync(join(tmpdir(), "blurrle-"));
const db = openDb(":memory:");
const manifest = readManifest();
const app = createApp(db, {
  imageDir: directory,
  now: () => new Date("2026-10-26T23:59:59Z"),
});
beforeAll(() => {
  migrate(db);
  for (const p of manifest)
    writeFileSync(join(directory, p.imagePath), "fixture");
  seed(db, manifest, directory);
});
afterAll(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
describe("daily API", () => {
  it("offers five distinct ordered faces per category and preserves selection on reseed", async () => {
    for (const category of [
      "actors",
      "world-leaders",
      "politicians",
      "ceos-founders",
    ]) {
      const first = await request(app)
        .get(`/api/daily/${category}`)
        .expect(200);
      expect(first.headers["cache-control"]).toBe("no-store");
      expect(first.body.day).toBe("2026-10-26");
      expect(
        new Set(first.body.rounds.map((r: { personId: string }) => r.personId))
          .size,
      ).toBe(5);
      seed(db, manifest, directory);
      const again = await request(app)
        .get(`/api/daily/${category}`)
        .expect(200);
      expect(again.body).toEqual(first.body);
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM daily_images").get()).toEqual({
      n: 20,
    });
  });
  it("validates category and refuses incomplete catalogs", async () => {
    await request(app).get("/api/daily/unknown").expect(404);
    const empty = openDb(":memory:");
    migrate(empty);
    empty
      .prepare("INSERT INTO categories VALUES (?,?)")
      .run("actors", "Actors");
    expect(() => getDaily(empty, "actors", "2026-10-26", directory)).toThrow(
      "not ready",
    );
    empty.close();
  });
});
