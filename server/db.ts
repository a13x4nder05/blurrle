import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
export type DB = Database.Database;
export const categories = [
  { slug: "actors", label: "Actors" },
  { slug: "world-leaders", label: "World leaders" },
  { slug: "politicians", label: "Politicians" },
  { slug: "ceos-founders", label: "CEOs / founders" },
];
export function openDb(
  path = process.env.DATABASE_PATH ?? "var/blurrle.sqlite",
) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}
export function migrate(db: DB) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)",
  );
  for (const version of readdirSync("server/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.transaction(() => {
      if (
        db
          .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
          .get(version)
      )
        return;
      db.exec(readFileSync(`server/migrations/${version}`, "utf8"));
      db.prepare("INSERT INTO schema_migrations(version) VALUES (?)").run(
        version,
      );
    }).immediate();
  }
}
