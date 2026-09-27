import { useState } from "react";

export function MapLegend() {
  const [open, setOpen] = useState(true);
  return (
    <aside className={`legend ${open ? "is-open" : ""}`} aria-label="Map legend">
      <button type="button" className="legend__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Legend <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="legend__grid">
          <div>
            <p className="legend__head">Utility</p>
            <p><span className="swatch swatch--desc" aria-hidden="true" /> DESC project</p>
            <p><span className="swatch swatch--gpc" aria-hidden="true" /> Georgia Power</p>
            <p><span className="shape shape--circle shape--hollow" aria-hidden="true" /> Approximate</p>
          </div>
          <div>
            <p className="legend__head">Relationship</p>
            <p><span className="swatch swatch--pair" aria-hidden="true" /> Selected pair</p>
            <p><span className="swatch swatch--other" aria-hidden="true" /> Other projects</p>
            <p className="muted">T1 touching · T2 &lt; 1 mi<br />T3 &lt; 5 mi · T4 ≤ 25 mi</p>
          </div>
        </div>
      )}
    </aside>
  );
}
