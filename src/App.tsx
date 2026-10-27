import { useCallback, useEffect, useRef, useState } from "react";
import { Landing } from "./components/Landing";
import { Game } from "./components/Game";
import { Results } from "./components/Results";
import { Credits } from "./components/Credits";
import {
  dailySchema,
  type Attempt,
  type Category,
  type Daily,
} from "./game/types";
import { newAttempt, transition, type Action } from "./game/reducer";
import {
  findPending,
  readRecord,
  saveAttempt,
  storageUnavailable,
  restoreOpenAttempt,
  closeAttempt,
} from "./game/storage";
import { createClock } from "./game/clock";
const fallbackCategories: Category[] = [
  { slug: "actors", label: "Actors" },
  { slug: "world-leaders", label: "World leaders" },
  { slug: "politicians", label: "Politicians" },
  { slug: "ceos-founders", label: "CEOs / founders" },
];
export default function App() {
  const [category, setCategory] = useState("actors");
  const [categories, setCategories] = useState(fallbackCategories);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    const saved = restoreOpenAttempt();
    return saved?.phase === "playing"
      ? transition(saved, { type: "checkpoint", elapsed: createClock(saved)() })
      : saved;
  });
  const current = useRef<Attempt | null>(attempt);
  const [credits, setCredits] = useState(false);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    if (attempt) saveAttempt(attempt);
  }, [attempt]);
  const apply = useCallback((action: Action) => {
    if (!current.current) return;
    const next = transition(current.current, action);
    current.current = next;
    saveAttempt(next);
    setAttempt(next);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/categories", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((items: Category[]) => {
        if (Array.isArray(items) && items.length) setCategories(items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (attempt) return;
    const controller = new AbortController();
    setDaily(null);
    setError("");
    const load = () =>
      fetch(`/api/daily/${category}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (r) => {
          const value = await r.json();
          if (!r.ok)
            throw new Error(value.error ?? "Today’s faces couldn’t load.");
          const parsed = dailySchema.safeParse(value);
          if (!parsed.success)
            throw new Error("Today’s faces couldn’t load. Please try again.");
          return parsed.data;
        })
        .then((value) => {
          if (!controller.signal.aborted) {
            setDaily(value);
            setError("");
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted)
            setError(
              err instanceof Error
                ? err.message
                : "The game couldn’t load. Try again.",
            );
        });
    void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      void load();
    }, 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [category, refresh, attempt]);
  async function play() {
    if (starting) return;
    let next = findPending(category);
    if (!next) {
      setStarting(true);
      try {
        // Recheck the server's date at play time, including across UTC midnight.
        const response = await fetch(`/api/daily/${category}`, {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("Today’s faces couldn’t load. Please try again.");
        const latest = dailySchema.safeParse(await response.json());
        if (!latest.success)
          throw new Error("Today’s faces couldn’t load. Please try again.");
        setDaily(latest.data);
        next = newAttempt(
          latest.data,
          Boolean(readRecord(latest.data.day, category)),
        );
      } catch {
        setError("Today’s faces couldn’t load. Please try again.");
        return;
      } finally {
        setStarting(false);
      }
    }
    if (next.phase === "playing")
      next = transition(next, {
        type: "checkpoint",
        elapsed: createClock(next)(),
      });
    current.current = next;
    saveAttempt(next);
    setAttempt(next);
  }
  const home = useCallback(() => {
    if (current.current?.phase === "playing")
      saveAttempt(
        transition(current.current, {
          type: "checkpoint",
          elapsed: createClock(current.current)(),
        }),
      );
    if (current.current) setCategory(current.current.daily.category);
    closeAttempt();
    current.current = null;
    setAttempt(null);
    setRefresh((r) => r + 1);
  }, []);
  const record = daily ? readRecord(daily.day, category) : null;
  return (
    <>
      {storageUnavailable && (
        <div className="storage-note" role="status">
          Progress can’t be saved in this browser. Keep this tab open.
        </div>
      )}
      {credits ? (
        <Credits onClose={() => setCredits(false)} />
      ) : attempt ? (
        attempt.phase === "results" ? (
          <Results attempt={attempt} onHome={home} />
        ) : (
          <Game
            key={`${attempt.id}:${attempt.index}`}
            attempt={attempt}
            onAction={apply}
            onHome={home}
          />
        )
      ) : (
        <Landing
          busy={starting}
          categories={categories}
          category={category}
          onCategory={setCategory}
          daily={daily}
          record={record}
          pending={Boolean(findPending(category))}
          error={error}
          onPlay={play}
          onRetry={() => setRefresh((r) => r + 1)}
          onCredits={() => setCredits(true)}
        />
      )}
    </>
  );
}
