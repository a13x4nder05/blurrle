import { useEffect, useState, type CSSProperties } from "react";

// Each mount samples the full cloud portrait catalog, independent of daily questions.
const filmAngles = [
  -17, 10, -4, 19, -12, 5, -21, 14, -7, 16, -2, 8, -14, 3, -9, 18, -5, 12, -19,
  6, -11, 20, -3, 9, -16, 4,
];
const filmLayers = [
  { className: "film-underlay", angles: Array.from({ length: 12 }, () => 0) },
  { className: "film-front", angles: filmAngles },
];
export function FilmBackdrop() {
  const [portraits, setPortraits] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backgrounds", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json();
      })
      .then((people: { id: string; imageUrl?: string }[]) => {
        setPortraits(
          people
            .map((person) => person.imageUrl ?? "")
            .filter((url) =>
              /^\/(?:portraits|backgrounds)\/(?:[a-f0-9]{12}|[a-f0-9]{24})\.webp$/.test(
                url,
              ),
            ),
        );
      })
      .catch(() => {}); // The solid background remains usable if offline.
    return () => controller.abort();
  }, []);
  return (
    <div className="film-backdrop" aria-hidden="true">
      {filmLayers.map((layer, layerIndex) => (
        <div
          className={`film-columns ${layer.className}`}
          key={layer.className}
        >
          {layer.angles.map((angle, column) => {
            const images = portraits.length
              ? Array.from(
                  { length: 8 },
                  (_, row) =>
                    portraits[
                      (layerIndex * 29 + column * 8 + row) % portraits.length
                    ],
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
      ))}
    </div>
  );
}
