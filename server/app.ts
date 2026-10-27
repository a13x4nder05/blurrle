import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { CloudCatalog } from "./cloud.js";
import { DailyError } from "./errors.js";
export function createApp(options: {
  cloud: CloudCatalog;
  now?: () => Date;
  serveClient?: boolean;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/categories", async (_req, res) =>
    res.json(await options.cloud.categories()),
  );
  app.get("/api/daily/:category", async (req, res) =>
    res.json(
      await options.cloud.daily(
        req.params.category,
        (options.now?.() ?? new Date()).toISOString().slice(0, 10),
      ),
    ),
  );
  app.get("/api/backgrounds", async (_req, res) =>
    res.json(await options.cloud.backgrounds()),
  );
  app.get("/api/credits", async (_req, res) =>
    res.json(await options.cloud.credits()),
  );
  for (const route of ["portraits", "backgrounds"] as const)
    app.get(`/${route}/:filename`, async (req, res) => {
      const pattern =
        route === "portraits"
          ? /^([a-f0-9]{12}|[a-f0-9]{24})\.webp$/
          : /^([a-f0-9]{24})\.webp$/;
      const match = pattern.exec(req.params.filename);
      if (!match) throw new DailyError("Image not found.", 404);
      const bytes = await options.cloud.image(
        match[1],
        route === "backgrounds",
      );
      res
        .set("Cache-Control", "public, max-age=86400, immutable")
        .type("image/webp")
        .send(bytes);
    });
  app.use(["/portraits", "/backgrounds"], (_req, res) =>
    res.status(404).json({ error: "Image not found." }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "That page could not be found." }),
  );
  if (options.serveClient !== false && existsSync("dist/client/index.html")) {
    app.use(express.static(resolve("dist/client")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/client/index.html")),
    );
  }
  app.use(
    (
      error: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next; // Express recognizes error middleware by its four-argument signature.
      const status =
        error instanceof DailyError
          ? error.status
          : error.status === 404
            ? 404
            : 500;
      if (status === 500) console.error(error);
      res.status(status).json({
        error:
          error instanceof DailyError
            ? error.message
            : status === 404
              ? "Image not found."
              : "The game could not load. Please try again.",
      });
    },
  );
  return app;
}
