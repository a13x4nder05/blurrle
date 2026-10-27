import { useEffect, useState, type CSSProperties } from "react";

// Use the curated catalog, independent of the day's questions and their order.
let catalog: string[] = [];
const filmAngles = [-17, 10, -4, 19, -12, 5, -21, 14, -7, 16, -2, 8, -14, 3];
export function FilmBackdrop() {
  const [portraits, setPortraits] = useState(catalog);
  useEffect(() => {
    if (catalog.length) return;
    const controller = new AbortController();
    fetch("/api/credits", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json();
      })
      .then((people: { id: string }[]) => {
        catalog = people
          .filter((person) => /^[a-f0-9]{12}$/.test(person.id))
          .slice(0, 30)
          .map((person) => `/portraits/${person.id}.webp`);
        setPortraits(catalog);
      })
      .catch(() => {}); // The solid background remains usable if offline.
    return () => controller.abort();
  }, []);
  return (
    <div className="film-backdrop" aria-hidden="true">
      <div className="film-columns">
        {filmAngles.map((angle, column) => {
          const images = portraits.length
            ? Array.from(
                { length: 8 },
                (_, row) => portraits[(column * 3 + row) % portraits.length],
              )
            : [];
          return (
            <div
              className="film-column"
              key={column}
              style={
                {
                  "--tilt": `${angle}deg`,
                  "--stagger": `${-((column * 73 + 35) % 210)}px`,
                  "--origin": `${30 + ((column * 7) % 31)}%`,
                  "--duration": `${62 + ((column * 13) % 37)}s`,
                  "--delay": `${-7 - column * 11}s`,
                  zIndex: (column * 5) % filmAngles.length,
                } as CSSProperties
              }
            >
              <div className="film-track">
                {[0, 1].map((copy) => (
                  <div className="film-sequence" key={copy}>
                    {images.map((url, row) => (
                      <div className="film-cell" key={row}>
                        <img src={url} alt="" draggable={false} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
