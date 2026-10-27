import { randomInt } from "node:crypto";
import { categories, categorySlugs } from "../src/game/categories.js";
import { dailySchema, type Daily } from "../src/game/types.js";
import { DailyError } from "./errors.js";
import { supabaseAdmin } from "./supabase-client.js";

type Person = {
  id: string;
  name: string;
  accepted_answers: string[];
  hint: string;
  review_status: string;
};
type Portrait = {
  id: string;
  person_id: string;
  storage_bucket: string;
  storage_path: string;
  review_status: string;
};
type CatalogPerson = Person & {
  portrait_id: string;
  categories: string[];
  image_source_url: string;
  image_license_name: string;
  image_license_url: string;
  attribution: string;
};
type BackgroundPortrait = Portrait & {
  people: { name: string; review_status: string };
  image_source_url: string | null;
  image_license_name: string | null;
  image_license_url: string | null;
  attribution: string | null;
  source_dataset_url: string;
  dataset_license_name: string;
  dataset_license_url: string;
  source_metadata: { creator?: string };
};
export function createCloudCatalog() {
  const admin = supabaseAdmin();
  const imageCache = new Map<string, Buffer>();
  let backgroundCache: { until: number; rows: BackgroundPortrait[] } | null =
    null;
  let catalogCache: { until: number; rows: CatalogPerson[] } | null = null;
  async function catalog() {
    if (catalogCache && catalogCache.until > Date.now())
      return catalogCache.rows;
    const rows = await admin.request<CatalogPerson[]>(
      "/rest/v1/blurrle_playable_people?select=*&order=name&limit=500",
    );
    catalogCache = { until: Date.now() + 30_000, rows };
    return rows;
  }
  async function fullCatalog() {
    if (backgroundCache && backgroundCache.until > Date.now())
      return backgroundCache.rows;
    const rows: BackgroundPortrait[] = [];
    let cursor = "";
    // Keyset pagination includes the full dataset, beyond Supabase's row limit.
    for (;;) {
      const page = await admin.request<BackgroundPortrait[]>(
        "/rest/v1/portraits?select=id,person_id,storage_bucket,storage_path,review_status,image_source_url,image_license_name,image_license_url,attribution,source_dataset_url,dataset_license_name,dataset_license_url,source_metadata,people!inner(name,review_status)&review_status=neq.rejected&people.review_status=neq.rejected&order=id&limit=500" +
          (cursor ? `&id=gt.${cursor}` : ""),
      );
      if (!page.length) break;
      rows.push(...page);
      const next = page[page.length - 1].id;
      if (next === cursor)
        throw new Error("Catalog pagination did not advance.");
      cursor = next;
    }
    backgroundCache = { until: Date.now() + 30_000, rows };
    return rows;
  }
  return {
    async categories() {
      const people = await catalog();
      return categories.map((category) => ({
        ...category,
        available:
          people.filter((person) => person.categories.includes(category.slug))
            .length >= 5,
      }));
    },
    async backgrounds() {
      const pool = [...(await fullCatalog())];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, 64).map((portrait) => ({
        id: portrait.id,
        imageUrl: `/backgrounds/${portrait.id}.webp`,
      }));
    },
    async credits() {
      return (await fullCatalog())
        .map((portrait) => ({
          id: portrait.id,
          name: portrait.people.name,
          sourcePageUrl:
            portrait.image_source_url || portrait.source_dataset_url,
          creator:
            portrait.source_metadata.creator ||
            "Photographer not supplied by source dataset",
          licenseName:
            portrait.image_license_name ||
            `Dataset license: ${portrait.dataset_license_name}`,
          licenseUrl:
            portrait.image_license_url || portrait.dataset_license_url,
          attribution:
            portrait.attribution ||
            "Individual image attribution and license were not supplied by the source dataset.",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async daily(category: string, day: string): Promise<Daily> {
      if (!(categorySlugs as readonly string[]).includes(category))
        throw new DailyError("Choose an available category.", 404);
      type Selected = {
        position: number;
        person_id: string;
        portrait_id: string;
      };
      const selectionPath = `/rest/v1/daily_images?day=eq.${day}&category_slug=eq.${category}&select=position,person_id,portrait_id&order=position`;
      let selected = await admin.request<Selected[]>(selectionPath);
      if (!selected.length) {
        await admin.request("/rest/v1/rpc/generate_blurrle_daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_day: day, p_category: category }),
        });
        selected = await admin.request<Selected[]>(selectionPath);
      }
      if (!selected.length)
        throw new DailyError(
          "This category is not ready yet. Please try another.",
          503,
        );
      if (
        selected.length !== 5 ||
        selected.some((row, index) => row.position !== index) ||
        new Set(selected.map((row) => row.person_id)).size !== 5
      )
        throw new DailyError(
          "Today’s game is unavailable. Please try again later.",
          503,
        );
      const ids = selected.map((row) => row.person_id).join(",");
      const photoIds = selected.map((row) => row.portrait_id).join(",");
      const [people, portraits] = await Promise.all([
        admin.request<Person[]>(
          `/rest/v1/people?id=in.(${ids})&select=id,name,accepted_answers,hint,review_status`,
        ),
        admin.request<Portrait[]>(
          `/rest/v1/portraits?id=in.(${photoIds})&select=id,person_id,storage_bucket,storage_path,review_status`,
        ),
      ]);
      const rounds = selected.map((row) => {
        const person = people.find((p) => p.id === row.person_id);
        const portrait = portraits.find(
          (p) => p.id === row.portrait_id && p.person_id === row.person_id,
        );
        if (
          !person ||
          !portrait ||
          person.review_status !== "approved" ||
          portrait.review_status !== "approved" ||
          !person.hint
        )
          throw new DailyError(
            "A portrait is unavailable. Please try again later.",
            503,
          );
        return {
          personId: person.id,
          imageUrl: `/portraits/${portrait.id}.webp`,
          name: person.name,
          acceptedAnswers: [
            ...new Set([person.name, ...person.accepted_answers]),
          ],
          hint: person.hint,
        };
      });
      return dailySchema.parse({ day, category, rounds });
    },
    async image(id: string, background = false) {
      // Resolve pre-cloud attempt snapshots through Supabase, without local files.
      if (!background && /^[a-f0-9]{12}$/.test(id)) {
        const rows = await admin.request<{ portrait_id: string }[]>(
          `/rest/v1/blurrle_playable_people?id=eq.${id}&select=portrait_id&limit=1`,
        );
        if (!rows[0]) throw new DailyError("Image not found.", 404);
        id = rows[0].portrait_id;
      }
      if (!/^[a-f0-9]{24}$/.test(id))
        throw new DailyError("Image not found.", 404);
      const approval = background ? "neq.rejected" : "eq.approved";
      const rows = await admin.request<
        (Portrait & { people: { review_status: string } })[]
      >(
        `/rest/v1/portraits?id=eq.${id}&review_status=${approval}&select=id,person_id,storage_bucket,storage_path,review_status,people!inner(review_status)&people.review_status=${approval}`,
      );
      const portrait = rows[0];
      if (!portrait) throw new DailyError("Image not found.", 404);
      const cached = imageCache.get(id);
      if (cached) return cached;
      const bytes = await admin.download(
        portrait.storage_bucket,
        portrait.storage_path,
      );
      if (imageCache.size >= 64)
        imageCache.delete(imageCache.keys().next().value!);
      imageCache.set(id, bytes);
      return bytes;
    },
  };
}
export type CloudCatalog = ReturnType<typeof createCloudCatalog>;
