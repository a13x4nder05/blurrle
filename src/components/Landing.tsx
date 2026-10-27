import { FilmBackdrop } from "./FilmBackdrop";
import { HowToPlay } from "./HowToPlay";
import { useEffect } from "react";
import type { Category, Daily, ScoreRecord } from "../game/types";
export function Landing({
  busy,
  categories,
  category,
  onCategory,
  daily,
  record,
  pending,
  error,
  onPlay,
  onRetry,
  onCredits,
}: {
  busy: boolean;
  categories: Category[];
  category: string;
  onCategory: (value: string) => void;
  daily: Daily | null;
  record: ScoreRecord | null;
  pending: boolean;
  error: string;
  onPlay: () => void;
  onRetry: () => void;
  onCredits: () => void;
}) {
  useEffect(() => {
    const startWithEnter = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.metaKey
      )
        return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      // Leave focused controls and open dialogs in charge of their own Enter action.
      if (
        document.querySelector("dialog[open]") ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "button, select, a, input, textarea, [contenteditable]",
          ))
      )
        return;
      event.preventDefault();
      if (!busy && (daily || pending)) onPlay();
    };
    window.addEventListener("keydown", startWithEnter);
    return () => window.removeEventListener("keydown", startWithEnter);
  }, [busy, daily, pending, onPlay]);
  return (
    <main className="landing">
      <FilmBackdrop />
      <section className="landing-center" aria-labelledby="title">
        <h1 id="title" className="wordmark">
          <span>blurr</span>le<span className="logo-period">.</span>
        </h1>
        <p className="tagline">Famous faces. Beat the blur.</p>
        <div className="landing-controls">
          <label className="category-control">
            <span>YOUR CATEGORY</span>
            <select
              disabled={busy}
              value={category}
              onChange={(e) => onCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary play-button enter-action"
            aria-keyshortcuts="Enter"
            onClick={onPlay}
            disabled={busy || (!daily && !pending)}
          >
            {busy
              ? "Loading…"
              : pending
                ? "Resume game"
                : record
                  ? "Play again"
                  : "Play today"}
            <kbd aria-hidden="true">Enter ↵</kbd>
          </button>
        </div>
        {error ? (
          <div className="error" role="alert">
            {error}{" "}
            <button className="text-button" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : !daily && !pending ? (
          <p className="status-note" role="status">
            Finding today’s faces…
          </p>
        ) : record ? (
          <p className="status-note">
            Your score for today{" "}
            <strong>{record.total.toLocaleString()} / 5,000</strong>
          </p>
        ) : (
          <p className="status-note">5 faces · 10 seconds each</p>
        )}
      </section>
      <button className="text-button credits-link" onClick={onCredits}>
        Photo credits
      </button>
      <HowToPlay />
    </main>
  );
}
