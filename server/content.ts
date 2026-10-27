import { z } from "zod";
import { readFileSync } from "node:fs";
import { categorySlugs } from "../src/game/categories.js";
export const personSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),
  name: z.string().min(1),
  hint: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  categories: z.array(z.enum(categorySlugs)).min(1),
  cropBottomFraction: z.number().min(0).max(0.5).optional(),
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
