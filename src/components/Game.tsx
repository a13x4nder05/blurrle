import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type CSSProperties,
} from "react";
import type { Attempt } from "../game/types";
import { hasUsedHint, type Action } from "../game/reducer";
import { createClock } from "../game/clock";
import { matchesRound, normalize } from "../game/answers";
import { ROUND_MS, score } from "../game/scoring";
import { categoryLabel } from "../game/categories";
import { HintCard } from "./HintCard";
const imageCache = new Map<string, Promise<void>>();
function preload(url: string) {
  if (!imageCache.has(url))
    imageCache.set(
      url,
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.src = url;
        image.decode().then(
          () => resolve(),
          () => {
            imageCache.delete(url);
            reject(new Error("Image unavailable"));
          },
        );
      }),
    );
  return imageCache.get(url)!;
}
export function Game({
  attempt,
  onAction,
  onHome,
}: {
  attempt: Attempt;
  onAction: (action: Action) => void;
  onHome: () => void;
}) {
  const round = attempt.daily.rounds[attempt.index];
  const [guess, setGuess] = useState("");
  const [elapsed, setElapsed] = useState(attempt.highElapsed);
  const [imageError, setImageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [wrongFeedback, setWrongFeedback] = useState(0);
  const [penaltyVisible, setPenaltyVisible] = useState(false);
  const held = useRef(false);
  // Meaningful actions checkpoint elapsed time before creating a fresh anchor.
  const clock = useMemo(() => createClock(attempt), [attempt]);
  const active = attempt.phase === "playing";
  const paused = attempt.phase === "hint";
  const revealed = attempt.phase === "round-result";
  useEffect(() => {
    if (!wrongFeedback) return;
    const timer = window.setTimeout(() => setPenaltyVisible(false), 800);
    return () => window.clearTimeout(timer);
  }, [wrongFeedback]);
  useEffect(() => {
    let cancelled = false;
    setImageError(false);
    preload(round.imageUrl)
      .then(() => {
        if (!cancelled && attempt.phase === "loading")
          onAction({ type: "start", now: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setImageError(true);
      });
    const upcoming = attempt.daily.rounds[attempt.index + 1];
    if (upcoming) void preload(upcoming.imageUrl).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    round.imageUrl,
    attempt.phase,
    attempt.index,
    attempt.daily.rounds,
    onAction,
    retry,
  ]);
  useEffect(() => {
    if (active) input.current?.focus();
    else if (revealed) next.current?.focus();
  }, [active, revealed]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      const ms = clock();
      setElapsed(ms);
      if (
        ms >= ROUND_MS ||
        (attempt.wrongGuesses > 0 && score(ms, attempt.wrongGuesses) === 0)
      )
        onAction({ type: "tick", elapsed: ms });
      else frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    const checkpoint = () => onAction({ type: "checkpoint", elapsed: clock() });
    document.addEventListener("visibilitychange", checkpoint);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", checkpoint);
      window.removeEventListener("pagehide", checkpoint);
    };
  }, [active, clock, onAction, attempt.wrongGuesses, attempt.hintUsed]);
  useEffect(() => {
    const release = () => {
      held.current = false;
    };
    window.addEventListener("keyup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  const submit = useCallback(() => {
    if (active) {
      const ms = clock();
      if (ms < ROUND_MS && normalize(guess)) {
        if (!matchesRound(guess, attempt.daily.rounds, attempt.index)) {
          setWrongFeedback((count) => count + 1);
          setPenaltyVisible(true);
          input.current?.select();
        } else setGuess("");
      }
      onAction({ type: "guess", guess, elapsed: ms });
    }
  }, [active, onAction, guess, clock, attempt.daily.rounds, attempt.index]);
  function onKeyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (event.repeat || held.current) return;
      held.current = true;
      // Escape dismisses the hint without also skipping the underlying round.
      if (paused) onAction({ type: "resume-hint", now: Date.now() });
      else if (active && !imageError)
        onAction({ type: "skip", elapsed: clock() });
      return;
    }
    if (event.key !== "Enter") return;
    if (event.repeat || held.current) {
      event.preventDefault();
      return;
    }
    held.current = true;
    if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (active && !imageError) onAction({ type: "hint", elapsed: clock() });
      return;
    }
    if (event.altKey || event.metaKey || event.shiftKey || event.ctrlKey) {
      event.preventDefault();
      return;
    }
    if (paused) {
      event.preventDefault();
      onAction({ type: "resume-hint", now: Date.now() });
    } else if (revealed) {
      event.preventDefault();
      onAction({ type: "next" });
    } else if (active && event.target === input.current) {
      event.preventDefault();
      submit();
    }
  }
  const displayedElapsed = active
    ? Math.max(elapsed, attempt.highElapsed)
    : attempt.highElapsed;
  const remaining = Math.max(0, (ROUND_MS - displayedElapsed) / 1000);
  const result = attempt.results[attempt.index];
  const shownScore = revealed
    ? result.score
    : score(displayedElapsed, attempt.wrongGuesses);
  return (
    <main
      className={`game-screen ${revealed ? result.outcome : ""}`}
      onKeyDown={onKeyDown}
    >
      <div
        className="portrait-backdrop"
        aria-hidden="true"
        style={{ backgroundImage: `url(${round.imageUrl})` }}
      />
      <div className="portrait-frame">
        <img
          key={retry}
          className={`portrait ${revealed ? "portrait-revealed" : ""}`}
          src={round.imageUrl}
          alt={revealed ? round.name : "Mystery person"}
          onError={() => setImageError(true)}
          style={{
            filter: `blur(${revealed ? 0 : 32 * (1 - displayedElapsed / ROUND_MS)}px)`,
          }}
        />
      </div>
      <div className="portrait-shade" />
      <header className="game-header">
        <button
          className="game-brand text-button"
          onClick={onHome}
          aria-label="Save and return home"
        >
          <span>blurr</span>le<span className="logo-period">.</span>
        </button>
        <span className="game-category">
          {categoryLabel(attempt.daily.category)}
        </span>
        <span className="round-label">
          FACE <strong>{String(attempt.index + 1).padStart(2, "0")}</strong>
          <span>/ 05</span>
        </span>
      </header>
      {imageError ? (
        <section className="image-error" role="alert">
          <p>This portrait couldn’t load.</p>
          <button
            className="button primary"
            onClick={() => {
              imageCache.delete(round.imageUrl);
              setRetry((r) => r + 1);
            }}
          >
            Try again
          </button>
          <button className="text-button" onClick={onHome}>
            Return home
          </button>
        </section>
      ) : attempt.phase === "loading" ? (
        <p className="loading-label" role="status">
          Loading portrait…
        </p>
      ) : null}
      <section
        className={`game-panel ${revealed ? "revealed" : ""}`}
        aria-label={revealed ? "Round result" : "Guess the person"}
      >
        {revealed ? (
          <>
            {result.outcome === "correct" && (
              <div className="celebration" aria-hidden="true">
                <span className="success-ring" />
                {Array.from({ length: 16 }, (_, i) => (
                  <i
                    key={i}
                    style={
                      {
                        "--angle": `${i * 22.5}deg`,
                        "--distance": `${100 + (i % 3) * 35}px`,
                        "--spark-color": [
                          "#ff806b",
                          "#ffd7a8",
                          "#ffffff",
                          "#a8bcff",
                        ][i % 4],
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="success-check">✓</span>
              </div>
            )}
            <h1 className="person-name">{round.name}</h1>
            <div className="round-outcome" role="status">
              {result.outcome === "correct"
                ? "Nicely spotted."
                : result.outcome === "skipped"
                  ? "Skipped."
                  : result.outcome === "exhausted"
                    ? "No points left."
                    : "Time’s up."}{" "}
              <strong>+{shownScore.toLocaleString()} points</strong>
            </div>
            <button
              className="button primary next-button enter-action"
              ref={next}
              onClick={() => onAction({ type: "next" })}
            >
              {attempt.index === 4 ? "See results" : "Next face"}
              <kbd aria-hidden="true">Enter ↵</kbd>
            </button>
          </>
        ) : (
          <>
            <div className="score-stage">
              {penaltyVisible && (
                <span
                  key={wrongFeedback}
                  className="penalty-pop"
                  aria-hidden="true"
                >
                  −100
                </span>
              )}
              <span
                className="available-score"
                aria-label={`${shownScore} points available`}
              >
                {shownScore}
                <small>PTS</small>
              </span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              autoComplete="off"
            >
              <label className="sr-only" htmlFor="guess">
                Your guess
              </label>
              <div
                className={`guess-field ${wrongFeedback ? (wrongFeedback % 2 ? "wrong-odd" : "wrong-even") : ""}`}
                data-error={penaltyVisible || undefined}
              >
                <input
                  ref={input}
                  id="guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Who is it?"
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  disabled={!active || imageError}
                />
                <button
                  type="submit"
                  disabled={!active || imageError}
                  aria-label="Submit guess"
                >
                  ↵
                </button>
              </div>
            </form>
            <div
              className="timer-track"
              role="progressbar"
              aria-label="Time remaining"
              aria-valuemin={0}
              aria-valuemax={ROUND_MS / 1000}
              aria-valuenow={Math.ceil(remaining)}
            >
              <div
                style={{
                  transform: `scaleX(${1 - displayedElapsed / ROUND_MS})`,
                }}
              />
            </div>
            <div className="game-meta">
              <button
                className="skip-button"
                aria-keyshortcuts="Escape"
                title="Skip face (Esc)"
                disabled={!active || imageError}
                onClick={() => onAction({ type: "skip", elapsed: clock() })}
              >
                Skip <kbd>Esc</kbd>
              </button>
              <button
                className="hint-button"
                aria-keyshortcuts="Shift+Enter"
                title="One free hint per game (Shift+Enter)"
                disabled={!active || imageError || hasUsedHint(attempt)}
                onClick={() => onAction({ type: "hint", elapsed: clock() })}
              >
                {hasUsedHint(attempt) ? (
                  "Hint used"
                ) : (
                  <>
                    Hint <kbd>⇧ ↵</kbd>
                  </>
                )}
              </button>
            </div>
            <div className="sr-only" role="status">
              {wrongFeedback > 0
                ? `Incorrect guess. 100 points deducted. Attempt ${wrongFeedback}.`
                : ""}
            </div>
          </>
        )}
      </section>
      {paused && (
        <HintCard
          hint={round.hint}
          onContinue={() => onAction({ type: "resume-hint", now: Date.now() })}
        />
      )}
    </main>
  );
}
