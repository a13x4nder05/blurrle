export const categorySlugs = [
  "actors",
  "world-leaders",
  "ceos-founders",
  "musicians",
  "athletes",
  "tv-reality",
  "other",
] as const;
export const categories = [
  { slug: "actors", label: "Actors" },
  { slug: "world-leaders", label: "World leaders" },
  { slug: "ceos-founders", label: "CEOs & Founders" },
  { slug: "musicians", label: "Musicians" },
  { slug: "athletes", label: "Athletes" },
  { slug: "tv-reality", label: "TV & Reality" },
  { slug: "other", label: "Other" },
] as const;
export const categoryLabel = (slug: string) =>
  categories.find((category) => category.slug === slug)?.label ??
  (slug === "politicians" ? "Politicians" : slug);
