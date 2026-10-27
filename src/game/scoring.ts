export const ROUND_MS = 10_000;
export function score(elapsedMs: number, wrongGuesses: number) {
  const elapsed = Math.min(ROUND_MS, Math.max(0, elapsedMs));
  // Normalize exponential loss to retain the 1,000-point start and zero endpoint.
  const timeValue = 1 - Math.expm1((3.6 * elapsed) / ROUND_MS) / Math.expm1(3.6);
  return Math.max(0, Math.floor(1000 * timeValue) - 100 * wrongGuesses);
}
