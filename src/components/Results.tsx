import { FilmBackdrop } from "./FilmBackdrop";
import { HowToPlay } from "./HowToPlay";
import { useEffect, useRef } from "react";
import type { Attempt } from "../game/types";
export function Results({
  attempt,
  onHome,
}: {
  attempt: Attempt;
  onHome: () => void;
}) {
  const home = useRef<HTMLButtonElement>(null);
  useEffect(() => home.current?.focus(), []);
  const total = attempt.results.reduce((s, r) => s + r.score, 0);
  return (
    <main
      className="results-screen"
      onKeyDown={(e) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.closest("dialog, button")
        )
          return;
        if (e.key === "Enter" && e.repeat) e.preventDefault();
        else if (
          e.key === "Enter" &&
          e.target !== home.current &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.nativeEvent.isComposing
        ) {
          e.preventDefault();
          onHome();
        }
      }}
    >
      <FilmBackdrop />
      <section className="results-content">
        <h1>Quite the eye.</h1>
        <div className="results-row">
          {attempt.daily.rounds.map((r, i) => (
            <article className="result-card" key={r.personId}>
              <div className="result-image">
                <img src={r.imageUrl} alt={r.name} />
              </div>
              <h2>{r.name}</h2>
              <p
                className={
                  attempt.results[i].outcome === "correct"
                    ? "result-points"
                    : "result-missed"
                }
              >
                {attempt.results[i].score.toLocaleString()} <small>pts</small>
              </p>
            </article>
          ))}
        </div>
        <div className="total-score">
          <span>YOUR {attempt.replay ? "REPLAY " : ""}SCORE</span>
          <strong>
            {total.toLocaleString()}
            <small>/ 5,000</small>
          </strong>
        </div>
        <button
          ref={home}
          className="button primary home-button"
          onClick={onHome}
        >
          Back to Blurrle<span aria-hidden="true">↗</span>
        </button>
      </section>
      <HowToPlay />
    </main>
  );
}
