import { openDb, migrate } from "../server/db.js";
const db = openDb();
try {
  migrate(db);
  console.log("Database migrations applied.");
} finally {
  db.close();
}
