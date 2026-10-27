import {
  attemptSchema,
  recordSchema,
  type Attempt,
  type ScoreRecord,
} from "./types";
const prefix = "blurrle:v1:";
export let storageUnavailable = false;
const memory = new Map<string, string>();
function read(key: string) {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    storageUnavailable = true;
    return memory.get(key) ?? null;
  }
}
function write(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    storageUnavailable = true;
  }
}
export function readRecord(day: string, category: string): ScoreRecord | null {
  try {
    const r = recordSchema.safeParse(
      JSON.parse(read(`${prefix}score:${day}:${category}`) ?? "null"),
    );
    return r.success && r.data.day === day && r.data.category === category
      ? r.data
      : null;
  } catch {
    return null;
  }
}
export function saveAttempt(attempt: Attempt) {
  const key = `${prefix}attempt:${attempt.daily.day}:${attempt.daily.category}`;
  write(key, JSON.stringify(attempt));
  try {
    sessionStorage.setItem(`${prefix}open`, key);
  } catch {
    /* In-memory play still works. */
  }
  if (
    attempt.results.length === 5 &&
    !readRecord(attempt.daily.day, attempt.daily.category)
  ) {
    write(
      `${prefix}score:${attempt.daily.day}:${attempt.daily.category}`,
      JSON.stringify({
        version: 1,
        day: attempt.daily.day,
        category: attempt.daily.category,
        results: attempt.results,
        total: attempt.results.reduce((s, r) => s + r.score, 0),
      }),
    );
  }
}
export function findPending(category: string): Attempt | null {
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.add(k);
    }
  } catch {
    storageUnavailable = true;
  }
  const attempts: Attempt[] = [];
  for (const key of keys) {
    if (!key.startsWith(`${prefix}attempt:`)) continue;
    try {
      const a = attemptSchema.safeParse(JSON.parse(read(key) ?? "null"));
      if (
        a.success &&
        a.data.daily.category === category &&
        a.data.phase !== "results" &&
        a.data.results.length < 5
      )
        attempts.push(a.data);
    } catch {
      /* Ignore invalid or old storage. */
    }
  }
  return (
    attempts.sort((a, b) => a.daily.day.localeCompare(b.daily.day))[0] ?? null
  );
}

export function restoreOpenAttempt(): Attempt | null {
  try {
    const key = sessionStorage.getItem(`${prefix}open`);
    if (!key?.startsWith(`${prefix}attempt:`)) return null;
    const value = attemptSchema.safeParse(JSON.parse(read(key) ?? "null"));
    return value.success ? value.data : null;
  } catch {
    return null;
  }
}
export function closeAttempt() {
  try {
    sessionStorage.removeItem(`${prefix}open`);
  } catch {
    /* Storage may be disabled. */
  }
}
