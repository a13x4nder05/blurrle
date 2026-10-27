import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { DB } from "./db.js";
import { DailyError, getDaily } from "./daily.js";
export function createApp(
  db: DB,
  options: { imageDir?: string; now?: () => Date } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/categories", (_req, res) =>
    res.json(
      db.prepare("SELECT slug,label FROM categories ORDER BY rowid").all(),
    ),
  );
  app.get("/api/daily/:category", (req, res, next) => {
    try {
      res.json(
        getDaily(
          db,
          req.params.category,
          (options.now?.() ?? new Date()).toISOString().slice(0, 10),
          options.imageDir,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/credits", (_req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,name,source_page_url AS sourcePageUrl,creator,license_name AS licenseName,license_url AS licenseUrl,attribution FROM people ORDER BY name",
        )
        .all(),
    ),
  );
  app.use(
    "/portraits",
    express.static(resolve(options.imageDir ?? "data/images"), {
      maxAge: "7d",
      immutable: true,
      fallthrough: false,
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "That page could not be found." }),
  );
  if (existsSync("dist/client/index.html")) {
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
