import { supabaseAdmin } from "./import/supabase.js";
import {
  suggestCategories,
  syncCategoryDefinitions,
} from "./import/categories.js";
import { categorySlugs } from "../src/game/categories.js";

async function main() {
  const admin = supabaseAdmin();
  await syncCategoryDefinitions(admin);
  const rows = await admin.request<
    { person_id: string; source_label: string }[]
  >(
    "/rest/v1/portraits?source_dataset=eq.kaggle-souvenger-celebrity-faces-v1&select=person_id,source_label&limit=1000",
  );
  // Suggestions remain pending alongside the portraits. Existing manual category
  // memberships are preserved, as are legacy category records and daily games.
  const memberships = new Map<
    string,
    { person_id: string; category_slug: string }
  >();
  const counts = Object.fromEntries(categorySlugs.map((slug) => [slug, 0]));
  for (const row of rows) {
    for (const slug of suggestCategories(row.source_label)) {
      const key = `${row.person_id}:${slug}`;
      if (!memberships.has(key)) counts[slug]++;
      memberships.set(key, { person_id: row.person_id, category_slug: slug });
    }
  }
  if (memberships.size)
    await admin.request(
      "/rest/v1/person_categories?on_conflict=person_id,category_slug",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify([...memberships.values()]),
      },
    );
  console.log(
    "Active category definitions synchronized. Pending membership suggestions:",
    counts,
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Category sync failed.",
  );
  process.exitCode = 1;
});
