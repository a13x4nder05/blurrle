import { useEffect, useRef, useState } from "react";
type Credit = {
  id: string;
  name: string;
  sourcePageUrl: string;
  creator: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
};
export function Credits({ onClose }: { onClose: () => void }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [error, setError] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const controller = new AbortController();
    fetch("/api/credits", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setCredits)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <main className="credits-screen">
      <header className="credits-header">
        <h1>Behind the faces.</h1>
        <button ref={close} className="button" onClick={onClose}>
          Back ↗
        </button>
      </header>
      <p>
        Curated portraits come from Wikimedia Commons and the credited
        photographers. Imported film-strip backgrounds link to their source
        dataset; where individual image licensing is unavailable, the dataset’s
        stated license is identified separately. Images are resized and
        converted to WebP, cropped for display, and temporarily blurred during
        play. Adapted images retain the source license listed below.
      </p>
      <p>
        Typography: DM Sans and Manrope, bundled locally under the SIL Open Font
        License. <a href="/licenses/dm-sans.txt">DM Sans license</a> ·{" "}
        <a href="/licenses/manrope.txt">Manrope license</a>
      </p>
      {error ? (
        <p role="alert">Credits could not load. Please return and try again.</p>
      ) : !credits.length ? (
        <p role="status">Loading credits…</p>
      ) : (
        <ul className="credits-list">
          {credits.map((c) => (
            <li key={c.id}>
              <a href={c.sourcePageUrl} target="_blank" rel="noreferrer">
                {c.name} ↗
              </a>
              <p>{c.attribution || c.creator}</p>
              <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                {c.licenseName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
