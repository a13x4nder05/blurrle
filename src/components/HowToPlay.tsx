import { useEffect, useRef, useState } from "react";

const steps = [
  { text: "Recognize the person as fast as possible." },
  { text: "Write your guess." },
  { text: "One free hint per daily game." },
  { text: "Coming soon: beat your friends on the daily leaderboard." },
];

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="help-button"
        aria-label="How to play"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open && <GuideCard onClose={() => setOpen(false)} />}
    </>
  );
}

function GuideCard({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const card = dialog.current;
    card?.showModal();
    close.current?.focus();
    return () => card?.close();
  }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(
      () => setStep((current) => (current + 1) % steps.length),
      5200,
    );
    return () => window.clearTimeout(timer);
  }, [step, reducedMotion]);
  return (
    <dialog
      ref={dialog}
      className="hint-card guide-card"
      aria-labelledby="guide-title"
      aria-describedby="guide-instructions"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (
          event.repeat ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229
        )
          return;
        onClose();
      }}
    >
      <h2 id="guide-title">Beat the blur.</h2>
      <ol id="guide-instructions" className="sr-only">
        {steps.map((item) => (
          <li key={item.text}>{item.text}</li>
        ))}
      </ol>
      <div className="guide-demo" aria-hidden="true">
        <div key={step} className={`guide-scene guide-step-${step}`}>
          {step === 3 ? (
            <div className="wire-rankings">
              <div className="wire-podium">
                <i />
                <i />
                <i />
              </div>
              <div className="wire-rank rank-friends">
                <span>02</span>
                <span>Friends</span>
                <i />
              </div>
              <div className="wire-rank rank-you">
                <span>01</span>
                <span>You</span>
                <i />
              </div>
              <div className="wire-rank rank-best">
                <span>03</span>
                <span>Best players</span>
                <i />
              </div>
            </div>
          ) : (
            <>
              <div className="wire-game">
                <div className="wire-header">
                  <span>blurrle.</span>
                  <span>1 / 5</span>
                </div>
                <div className="wire-face">
                  <span className="wire-head" />
                  <span className="wire-shoulders" />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="wire-controls">
                  <div className="wire-points">850</div>
                  <div className="wire-input">
                    <span className="wire-typing">••••••••••••</span>
                    <span>↵</span>
                  </div>
                  <div className="wire-timer">
                    <i />
                  </div>
                  <div className="wire-actions">
                    <span>Skip</span>
                    <span className="wire-hint">Hint ⇧ ↵</span>
                  </div>
                </div>
              </div>
              {step === 2 && (
                <div className="wire-hint-card">
                  <span>Your clue</span>
                  <i />
                  <i />
                  <span className="wire-continue">Continue ↵</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div key={step} className="guide-caption" aria-hidden="true">
        <p>{steps[step].text}</p>
      </div>
      <div className="guide-navigation">
        <div className="guide-dots" aria-label="Instruction steps">
          {steps.map((item, index) => (
            <button
              key={item.text}
              aria-label={`Step ${index + 1}: ${item.text}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <i />
            </button>
          ))}
        </div>
      </div>
      <button
        ref={close}
        className="button primary enter-action"
        onClick={onClose}
      >
        Got it <kbd aria-hidden="true">Enter ↵</kbd>
      </button>
    </dialog>
  );
}
