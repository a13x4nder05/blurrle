import type { Attempt, Daily, RoundResult } from "./types";
import { ROUND_MS, score } from "./scoring";
import { matchesRound, normalize } from "./answers";
export function newAttempt(daily: Daily, replay = false): Attempt {
  return {
    version: 1,
    id: crypto.randomUUID(),
    daily,
    index: 0,
    phase: "loading",
    startedAt: null,
    deadline: null,
    highElapsed: 0,
    wrongGuesses: 0,
    hintUsed: false,
    results: [],
    replay,
  };
}
export const hasUsedHint = (attempt: Attempt) =>
  attempt.hintUsed || attempt.results.some((result) => result.hintUsed);

export type Action =
  | { type: "start"; now: number }
  | { type: "resume-hint"; now: number }
  | { type: "guess"; guess: string; elapsed: number }
  | { type: "hint" | "tick" | "checkpoint" | "skip"; elapsed: number }
  | { type: "next" };

function finishRound(
  state: Attempt,
  outcome: RoundResult["outcome"],
  elapsed: number,
): Attempt {
  return {
    ...state,
    phase: "round-result",
    highElapsed: elapsed,
    results: [
      ...state.results,
      {
        outcome,
        score: outcome === "correct" ? score(elapsed, state.wrongGuesses) : 0,
        elapsedMs: elapsed,
        wrongGuesses: state.wrongGuesses,
        hintUsed: state.hintUsed,
      },
    ],
  };
}

export function transition(state: Attempt, action: Action): Attempt {
  if (action.type === "resume-hint") {
    if (state.phase !== "hint") return state;
    if (score(state.highElapsed, state.wrongGuesses) === 0)
      return finishRound(state, "exhausted", state.highElapsed);
    return {
      ...state,
      phase: "playing",
      startedAt: action.now - state.highElapsed,
      deadline: action.now + ROUND_MS - state.highElapsed,
    };
  }
  if (action.type === "start")
    return state.phase === "loading"
      ? {
          ...state,
          phase: "playing",
          startedAt: action.now,
          deadline: action.now + ROUND_MS,
        }
      : state;
  if (action.type === "next") {
    if (state.phase !== "round-result") return state;
    if (state.index === 4) return { ...state, phase: "results" };
    return {
      ...state,
      index: state.index + 1,
      phase: "loading",
      startedAt: null,
      deadline: null,
      highElapsed: 0,
      wrongGuesses: 0,
      hintUsed: false,
    };
  }
  if (state.phase !== "playing") return state;
  const elapsed = Math.min(
    ROUND_MS,
    Math.max(state.highElapsed, action.elapsed, 0),
  );
  if (elapsed >= ROUND_MS) return finishRound(state, "timeout", elapsed);
  if (state.wrongGuesses > 0 && score(elapsed, state.wrongGuesses) === 0)
    return finishRound(state, "exhausted", elapsed);
  if (action.type === "skip") return finishRound(state, "skipped", elapsed);
  if (action.type === "guess") {
    if (!normalize(action.guess)) return state;
    if (matchesRound(action.guess, state.daily.rounds, state.index))
      return finishRound(state, "correct", elapsed);
    const wrong = {
      ...state,
      highElapsed: elapsed,
      wrongGuesses: state.wrongGuesses + 1,
    };
    return score(elapsed, wrong.wrongGuesses) === 0
      ? finishRound(wrong, "exhausted", elapsed)
      : wrong;
  }
  if (action.type === "hint") {
    if (hasUsedHint(state)) return state;
    return {
      ...state,
      highElapsed: elapsed,
      hintUsed: true,
      phase: "hint",
    };
  }
  return { ...state, highElapsed: elapsed };
}
