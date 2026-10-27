import { openDb, migrate } from "../server/db.js";
import { readManifest, seed } from "../server/content.js";
const db = openDb();
try {
  migrate(db);
  const people = readManifest();
  seed(db, people);
  console.log(
    `Seeded ${people.length} people. Existing daily selections preserved.`,
  );
} finally {
  db.close();
}
