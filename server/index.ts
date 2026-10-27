import { createCloudCatalog } from "./cloud.js";
import { createApp } from "./app.js";
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const server = createApp({ cloud: createCloudCatalog() }).listen(
  port,
  host,
  () => console.log(`Blurrle API ready at http://${host}:${port} (Supabase)`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
