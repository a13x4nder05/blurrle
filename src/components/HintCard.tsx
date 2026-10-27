import { useEffect, useRef } from "react";

export function HintCard({
  hint,
  onContinue,
}: {
  hint: string;
  onContinue: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const card = dialog.current;
    card?.showModal();
    continueButton.current?.focus();
    return () => card?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="hint-card"
      aria-labelledby="hint-title"
      aria-describedby="hint-copy"
      onCancel={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <h2 id="hint-title">Here’s your clue.</h2>
      <p id="hint-copy">{hint}</p>
      <button
        ref={continueButton}
        className="button primary enter-action"
        aria-keyshortcuts="Enter"
        onClick={onContinue}
      >
        Continue guessing <kbd aria-hidden="true">Enter ↵</kbd>
      </button>
    </dialog>
  );
}
