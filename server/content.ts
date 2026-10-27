import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { categories, type DB } from "./db.js";
export const personSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),
  name: z.string().min(1),
  hint: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  categories: z
    .array(z.enum(["actors", "world-leaders", "politicians", "ceos-founders"]))
    .min(1),
  imagePath: z.string().regex(/^[a-f0-9]{12}\.webp$/),
  sourcePageUrl: z.url(),
  sourceAssetUrl: z.url(),
  creator: z.string().min(1),
  licenseName: z.string().min(1),
  licenseUrl: z.url(),
  attribution: z.string().min(1),
});
export type Person = z.infer<typeof personSchema>;
export function readManifest(): Person[] {
  return z
    .array(personSchema)
    .parse(JSON.parse(readFileSync("data/people.json", "utf8")));
}
export function seed(db: DB, people: Person[], imageDir = "data/images") {
  if (new Set(people.map((p) => p.id)).size !== people.length)
    throw new Error("Duplicate person IDs in manifest.");
  for (const p of people) {
    personSchema.parse(p);
    if (!existsSync(join(imageDir, p.imagePath)))
      throw new Error(
        `Missing portrait for ${p.name}. Run npm run assets:fetch.`,
      );
  }
  for (const cat of categories)
    if (
      people.filter((p) =>
        p.categories.includes(cat.slug as Person["categories"][number]),
      ).length < 5
    ) {
      throw new Error(`At least five people required for ${cat.label}.`);
    }
  db.transaction(() => {
    for (const c of categories)
      db.prepare(
        "INSERT INTO categories(slug,label) VALUES (?,?) ON CONFLICT(slug) DO UPDATE SET label=excluded.label",
      ).run(c.slug, c.label);
    for (const p of people) {
      db.prepare(
        `INSERT INTO people VALUES (@id,@name,@hint,@imagePath,@sourcePageUrl,@sourceAssetUrl,@creator,@licenseName,@licenseUrl,@attribution)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, hint=excluded.hint, image_path=excluded.image_path,
        source_page_url=excluded.source_page_url, source_asset_url=excluded.source_asset_url, creator=excluded.creator,
        license_name=excluded.license_name, license_url=excluded.license_url, attribution=excluded.attribution`,
      ).run(p);
      db.prepare("DELETE FROM person_aliases WHERE person_id=?").run(p.id);
      db.prepare("DELETE FROM person_categories WHERE person_id=?").run(p.id);
      for (const a of new Set([p.name, ...p.aliases]))
        db.prepare("INSERT INTO person_aliases VALUES (?,?)").run(p.id, a);
      for (const c of new Set(p.categories))
        db.prepare("INSERT INTO person_categories VALUES (?,?)").run(p.id, c);
    }
  }).immediate();
}
