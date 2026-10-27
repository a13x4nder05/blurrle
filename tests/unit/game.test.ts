import { describe, it, expect } from "vitest";
import { score } from "../../src/game/scoring";
import { matches } from "../../src/game/answers";
import { newAttempt, transition } from "../../src/game/reducer";
import { createClock } from "../../src/game/clock";
import { attemptSchema, type Daily } from "../../src/game/types";
const daily: Daily = {
  day: "2026-10-26",
  category: "actors",
  rounds: Array.from({ length: 5 }, (_, i) => ({
    personId: `${i}`,
    imageUrl: "/portraits/000000000001.webp",
    name: "Bryan Cranston",
    acceptedAnswers: ["Bryan Cranston", "Cranston"],
    hint: "Walter White",
  })),
};
describe("game rules", () => {
  it("uses accelerating exponential time decay, penalties, and a zero floor", () => {
    expect(score(0, 0)).toBe(1000);
    expect(score(5000, 0)).toBe(858);
    expect(score(10000, 0)).toBe(0);
    expect(score(5000, 1)).toBe(758);
    expect(score(9500, 2)).toBe(0);
  });
  it("accepts normalized names, aliases, and first names", () => {
    expect(
      matches("  BRYAN   Cranston ", daily.rounds[0].acceptedAnswers),
    ).toBe(true);
    expect(matches("Ｃｒａｎｓｔｏｎ", daily.rounds[0].acceptedAnswers)).toBe(
      true,
    );
    expect(matches("Bryan", daily.rounds[0].acceptedAnswers)).toBe(true);
  });
  it("pauses for a free hint, ignores blanks, and freezes the result", () => {
    let a = transition(newAttempt(daily), { type: "start", now: 1000 });
    a = transition(a, { type: "guess", guess: " ", elapsed: 100 });
    expect(a.wrongGuesses).toBe(0);
    a = transition(a, { type: "guess", guess: "someone else", elapsed: 1000 });
    a = transition(a, { type: "hint", elapsed: 1000 });
    a = transition(a, { type: "hint", elapsed: 1000 });
    a = transition(a, { type: "resume-hint", now: 2000 });
    a = transition(a, { type: "guess", guess: "Cranston", elapsed: 1500 });
    expect(a.phase).toBe("round-result");
    expect(a.results[0].score).toBe(879);
    expect(
      transition(a, { type: "guess", guess: "wrong", elapsed: 2000 }),
    ).toBe(a);
    expect(transition(a, { type: "next" }).index).toBe(1);
  });
  it("rejects guesses and hints at the deadline", () => {
    const a = transition(newAttempt(daily), { type: "start", now: 0 });
    for (const action of [
      { type: "guess" as const, guess: "Cranston", elapsed: 10000 },
      { type: "hint" as const, elapsed: 10000 },
    ]) {
      const ended = transition(a, action);
      expect(ended.results[0].outcome).toBe("timeout");
      expect(ended.results[0].score).toBe(0);
    }
  });
  it("uses monotonic elapsed time if the wall clock moves backward", () => {
    const a = transition(newAttempt(daily), { type: "start", now: 1000 });
    let wall = 2000,
      mono = 100;
    const clock = createClock(
      a,
      () => wall,
      () => mono,
    );
    expect(clock()).toBe(1000);
    wall = 500;
    mono = 600;
    expect(clock()).toBe(1500);
  });
  it("pins the daily payload and rejects corrupt progress", () => {
    let a = newAttempt(daily);
    for (let i = 0; i < 5; i++) {
      a = transition(a, { type: "start", now: 0 });
      a = transition(a, { type: "tick", elapsed: 10000 });
      if (i < 4) a = transition(a, { type: "next" });
    }
    expect(a.results.length).toBe(5);
    expect(transition(a, { type: "next" }).phase).toBe("results");
    expect(a.daily.day).toBe("2026-10-26");
    expect(attemptSchema.safeParse({ ...a, results: [] }).success).toBe(false);
  });
});
