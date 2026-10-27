CREATE TABLE categories (slug TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE people (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, hint TEXT NOT NULL, image_path TEXT NOT NULL,
 source_page_url TEXT NOT NULL, source_asset_url TEXT NOT NULL, creator TEXT NOT NULL,
 license_name TEXT NOT NULL, license_url TEXT NOT NULL, attribution TEXT NOT NULL
);
CREATE TABLE person_aliases (person_id TEXT NOT NULL REFERENCES people(id), alias TEXT NOT NULL, PRIMARY KEY (person_id, alias));
CREATE TABLE person_categories (person_id TEXT NOT NULL REFERENCES people(id), category_slug TEXT NOT NULL REFERENCES categories(slug), PRIMARY KEY (person_id, category_slug));
CREATE TABLE daily_images (
 day TEXT NOT NULL, category_slug TEXT NOT NULL REFERENCES categories(slug), position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4), person_id TEXT NOT NULL REFERENCES people(id),
 PRIMARY KEY (day, category_slug, position), UNIQUE(day, category_slug, person_id)
);
