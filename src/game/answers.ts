import type { Round } from "./types";

export const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const titles = new Set([
  "sir",
  "lady",
  "dr",
  "president",
  "king",
  "queen",
  "prince",
  "princess",
]);
function variants(answers: string[]) {
  const names = new Set<string>();
  for (const answer of answers) {
    const name = normalize(answer);
    if (!name) continue;
    names.add(name);
    const words = name.split(" ");
    for (const part of [words[0], words[words.length - 1]]) {
      if (part.length >= 3 && !titles.has(part)) names.add(part);
    }
  }
  return [...names];
}

// Small spelling mistakes include an adjacent letter swap, e.g. "Crantson".
function editDistance(a: string, b: string) {
  const grid = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
    }
  }
  return grid[a.length][b.length];
}
function matchDistance(guess: string, answers: string[]) {
  let best = Infinity;
  for (const name of variants(answers)) {
    if (guess === name) return 0;
    // Do not match a different full name just because its first name matches.
    if (guess.split(" ").length !== name.split(" ").length) continue;
    const letters = name.replaceAll(" ", "").length;
    const tolerance = letters >= 9 ? 2 : letters >= 4 ? 1 : 0;
    if (
      !tolerance ||
      guess.length < 3 ||
      Math.abs(guess.length - name.length) > tolerance
    )
      continue;
    const distance = editDistance(guess, name);
    if (distance <= tolerance) best = Math.min(best, distance);
  }
  return best;
}
export function matches(
  guess: string,
  answers: string[],
  otherAnswers: string[][] = [],
) {
  const value = normalize(guess);
  if (!value || value.length > 160) return false;
  const distance = matchDistance(value, answers);
  return (
    Number.isFinite(distance) &&
    otherAnswers.every((other) => matchDistance(value, other) > distance)
  );
}
export function matchesRound(guess: string, rounds: Round[], index: number) {
  return matches(
    guess,
    rounds[index].acceptedAnswers,
    rounds.filter((_, i) => i !== index).map((round) => round.acceptedAnswers),
  );
}
