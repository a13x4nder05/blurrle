import { z } from "zod";
import { ROUND_MS } from "./scoring.js";
export const roundSchema = z.object({
  personId: z.string(),
  imageUrl: z.string().regex(/^\/portraits\/[a-f0-9]{12}\.webp$/),
  name: z.string().min(1),
  acceptedAnswers: z.array(z.string()).min(1),
  hint: z.string(),
});
export const dailySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["actors", "world-leaders", "politicians", "ceos-founders"]),
  rounds: z.array(roundSchema).length(5),
});
const resultSchema = z.object({
  score: z.number().int().min(0).max(1000),
  outcome: z.enum(["correct", "timeout", "skipped", "exhausted"]),
  elapsedMs: z.number().min(0).max(15000),
  wrongGuesses: z.number().int().nonnegative(),
  hintUsed: z.boolean(),
});
export const attemptSchema = z
  .object({
    version: z.literal(1),
    id: z.string(),
    daily: dailySchema,
    index: z.number().int().min(0).max(4),
    phase: z.enum(["loading", "playing", "hint", "round-result", "results"]),
    startedAt: z.number().nullable(),
    deadline: z.number().nullable(),
    highElapsed: z.number().min(0).max(15000),
    wrongGuesses: z.number().int().nonnegative(),
    hintUsed: z.boolean(),
    results: z.array(resultSchema).max(5),
    replay: z.boolean(),
  })
  .superRefine((a, ctx) => {
    const count =
      a.phase === "round-result" || a.phase === "results"
        ? a.index + 1
        : a.index;
    if (a.results.length !== count || (a.phase === "results" && a.index !== 4))
      ctx.addIssue({ code: "custom", message: "Invalid round history" });
    if (
      (a.phase === "playing" || a.phase === "hint") &&
      (a.startedAt === null ||
        a.deadline === null ||
        ![ROUND_MS, 15000].includes(a.deadline - a.startedAt))
    )
      ctx.addIssue({ code: "custom", message: "Invalid round clock" });
    if (a.phase === "hint" && !a.hintUsed)
      ctx.addIssue({ code: "custom", message: "Invalid hint pause" });
  })
  // Migrate a pre-redesign active round without resetting its start or penalties.
  // Completed results retain their original timing and score.
  .transform((a) => ({
    ...a,
    deadline: a.startedAt === null ? a.deadline : a.startedAt + ROUND_MS,
    highElapsed: Math.min(ROUND_MS, a.highElapsed),
  }));
export const recordSchema = z
  .object({
    version: z.literal(1),
    day: z.string(),
    category: z.string(),
    total: z.number().int().min(0).max(5000),
    results: z.array(resultSchema).length(5),
  })
  .refine((r) => r.total === r.results.reduce((s, r) => s + r.score, 0));
export type Daily = z.infer<typeof dailySchema>;
export type Round = Daily["rounds"][number];
export type RoundResult = z.infer<typeof resultSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type ScoreRecord = z.infer<typeof recordSchema>;
export type Category = { slug: string; label: string };
