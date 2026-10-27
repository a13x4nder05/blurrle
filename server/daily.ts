import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "./db.js";
import type { Daily } from "../src/game/types.js";
export class DailyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function getDaily(
  db: DB,
  category: string,
  day: string,
  imageDir = "data/images",
): Daily {
  if (!db.prepare("SELECT 1 FROM categories WHERE slug=?").get(category))
    throw new DailyError("Choose an available category.", 404);
  const rows = db
    .transaction(() => {
      let selected = db
        .prepare(
          "SELECT person_id FROM daily_images WHERE day=? AND category_slug=? ORDER BY position",
        )
        .all(day, category) as { person_id: string }[];
      if (!selected.length) {
        const eligible = (
          db
            .prepare(
              "SELECT p.id, p.image_path FROM people p JOIN person_categories c ON c.person_id=p.id WHERE c.category_slug=?",
            )
            .all(category) as { id: string; image_path: string }[]
        )
          .filter((p) => existsSync(join(imageDir, p.image_path)))
          .map((p) => ({
            ...p,
            rank: createHash("sha256")
              .update(`blurrle-v1:${day}:${category}:${p.id}`)
              .digest("hex"),
          }))
          .sort(
            (a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id),
          );
        if (eligible.length < 5)
          throw new DailyError(
            "This category is not ready yet. Please try another.",
            503,
          );
        eligible
          .slice(0, 5)
          .forEach((p, i) =>
            db
              .prepare("INSERT INTO daily_images VALUES (?,?,?,?)")
              .run(day, category, i, p.id),
          );
        selected = eligible.slice(0, 5).map((p) => ({ person_id: p.id }));
      }
      if (selected.length !== 5)
        throw new DailyError(
          "Today’s game is unavailable. Please try again later.",
          503,
        );
      return selected.map(({ person_id }) => {
        const p = db
          .prepare("SELECT * FROM people WHERE id=?")
          .get(person_id) as Record<string, string>;
        if (!p || !existsSync(join(imageDir, p.image_path)))
          throw new DailyError(
            "A portrait is unavailable. Please try again later.",
            503,
          );
        const aliases = db
          .prepare("SELECT alias FROM person_aliases WHERE person_id=?")
          .all(person_id) as { alias: string }[];
        return {
          personId: p.id,
          imageUrl: `/portraits/${p.image_path}`,
          name: p.name,
          acceptedAnswers: [
            ...new Set([p.name, ...aliases.map((a) => a.alias)]),
          ],
          hint: p.hint,
        };
      });
    })
    .immediate();
  return { day, category: category as Daily["category"], rounds: rows };
}
