import type { Attempt } from "./types";
import { ROUND_MS } from "./scoring";
export function createClock(
  attempt: Attempt,
  wall = Date.now,
  mono = () => performance.now(),
) {
  if (attempt.phase === "hint")
    return () => Math.min(ROUND_MS, Math.max(0, attempt.highElapsed));
  const initial = Math.max(
    attempt.highElapsed,
    attempt.startedAt === null ? 0 : wall() - attempt.startedAt,
  );
  const anchor = mono();
  let highest = initial;
  return () => {
    highest = Math.max(
      highest,
      initial + mono() - anchor,
      attempt.startedAt === null ? 0 : wall() - attempt.startedAt,
    );
    return Math.min(ROUND_MS, Math.max(0, highest));
  };
}
