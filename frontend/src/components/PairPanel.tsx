import type { ReactNode } from "react";
import type { Opportunity } from "../types";

interface Props {
  items: Opportunity[];
  selectedId: string | null;
  onBack: () => void;
  onSelect: (id: string) => void;
  wide: boolean;
  onWide: (wide: boolean) => void;
  children: ReactNode;
}

/** Detail mode of the left column: back to the queue, step through the ranked pairs, widen the panel. */
export function PairPanel({ items, selectedId, onBack, onSelect, wide, onWide, children }: Props) {
  const index = items.findIndex((o) => o.id === selectedId);
  const current = index >= 0 ? items[index] : null;
  const step = (delta: number) => { const next = items[index + delta]; if (next) onSelect(next.id); };
  return (
    <section className="pair-panel" aria-label="Pair detail">
      <div className="pair-panel__nav">
        <button type="button" className="btn" onClick={onBack}><span aria-hidden="true">‹</span> Back to list</button>
        <span className="spacer" />
        <div className="btn-group" role="group" aria-label="Step through pairs">
          <button type="button" className="btn" onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous pair"><span aria-hidden="true">‹</span> Prev</button>
          <span className="btn-group__count">{index >= 0 ? `${index + 1} / ${items.length}` : `– / ${items.length}`}</span>
          <button type="button" className="btn" onClick={() => step(1)} disabled={index < 0 || index >= items.length - 1} aria-label="Next pair">Next <span aria-hidden="true">›</span></button>
        </div>
        <button type="button" className="btn" aria-pressed={wide} onClick={() => onWide(!wide)} aria-label={wide ? "Narrow panel" : "Widen panel"}>
          <span aria-hidden="true">{wide ? "⇤" : "⇥"}</span> {wide ? "Narrow" : "Widen"}
        </button>
      </div>
      {current && (
        <p className="breadcrumb">
          <button type="button" className="link-btn" onClick={onBack}>Opportunities</button>
          <span aria-hidden="true"> / </span>
          <span className="breadcrumb__here" title={`${current.a.name} × ${current.b.name}`}>#{String(current.rank).padStart(2, "0")} · {current.a.name} × {current.b.name}</span>
        </p>
      )}
      <div className="pair-panel__body">{children}</div>
    </section>
  );
}
