import { openDb, migrate } from "./db.js";
import { createApp } from "./app.js";
const db = openDb();
migrate(db);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const server = createApp(db).listen(port, host, () =>
  console.log(`Blurrle API ready at http://${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
