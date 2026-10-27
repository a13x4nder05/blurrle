import { readFileSync } from "node:fs";
import { z } from "zod";
import { categories, categorySlugs } from "../../src/game/categories.js";

const groups = z
  .record(z.enum(categorySlugs), z.array(z.string()))
  .parse(JSON.parse(readFileSync("data/import-categories.json", "utf8")));
const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function suggestCategories(
  name: string,
): (typeof categorySlugs)[number][] {
  const key = normalizeName(name);
  const matches = categorySlugs.filter((slug) =>
    groups[slug]?.some((item) => normalizeName(item) === key),
  );
  return matches.length ? matches : ["other"];
}
export async function syncCategoryDefinitions(admin: {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  await admin.request("/rest/v1/categories?on_conflict=slug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(categories),
  });
}
