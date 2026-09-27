import type { Method } from "../types";
import { radioProps } from "../useRovingRadio";

const METHODS: readonly Method[] = ["center", "closest"];

export type View = "opportunities" | "changes" | "quality";

interface Props {
  view: View;
  onView: (v: View) => void;
  method: Method;
  onMethod: (m: Method) => void;
  distance: number;
  onDistance: (d: number) => void;
  dataMode: string | null;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "opportunities", label: "OPPORTUNITIES" },
  { id: "changes", label: "PLAN CHANGES" },
  { id: "quality", label: "DATA QUALITY" },
];

export function TopBar({ view, onView, method, onMethod, distance, onDistance, dataMode }: Props) {
  return (
    <header className="topbar">
      <div className="brand"><span className="brand__mark" aria-hidden="true" /> GridPulse
        <span className="muted brand__sub">DESC × Georgia Power coordination</span></div>
      <nav className="tabs" aria-label="Views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className="tab" aria-current={view === v.id ? "page" : undefined} onClick={() => onView(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>
      <div className="controls">
        <div className="segmented" role="radiogroup" aria-label="Distance method">
          <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "center")}>CENTERS</button>
          <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "closest")}>CLOSEST</button>
        </div>
        <label className="slider">
          <span className="field__label">Within</span>
          <input type="range" min={5} max={50} step={1} value={distance} onChange={(e) => onDistance(Number(e.target.value))}
                 aria-valuetext={`${distance} miles`} />
          <span className="mono">{distance} mi</span>
        </label>
        <span className="tag" title="Data source mode">{dataMode === "db" ? "LIVE DB" : "SEED"}</span>
      </div>
    </header>
  );
}
