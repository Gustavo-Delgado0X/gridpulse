import type { Method } from "../types";
import { radioProps } from "../useRovingRadio";

const METHODS: readonly Method[] = ["center", "closest"];

export type View = "opportunities" | "changes" | "quality";
export type Theme = "light" | "dark";

interface Props {
  view: View;
  onView: (v: View) => void;
  method: Method;
  onMethod: (m: Method) => void;
  distance: number;
  onDistance: (d: number) => void;
  dataMode: string | null;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onHelp: () => void;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "opportunities", label: "OPPORTUNITIES" },
  { id: "changes", label: "PLAN CHANGES" },
  { id: "quality", label: "DATA QUALITY" },
];

export function TopBar({ view, onView, method, onMethod, distance, onDistance, dataMode, theme, onTheme, onHelp }: Props) {
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
        <div className="segmented" role="radiogroup" aria-label="Distance method" title="M switches method">
          <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "center")}>CENTERS</button>
          <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "closest")}>CLOSEST</button>
        </div>
        <label className="slider">
          <span className="field__label">Within</span>
          <input type="range" min={5} max={50} step={1} value={distance} onChange={(e) => onDistance(Number(e.target.value))}
                 aria-valuetext={`${distance} miles`} style={{ ["--fill" as string]: `${((distance - 5) / 45) * 100}%` }} />
          <span className="mono slider__value">{distance} mi</span>
        </label>
        <span className="tag tag--xs" title="Data source mode">{dataMode === "db" ? "LIVE DB" : "SEED"}</span>
        <button type="button" className="icon-btn" onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Theme">
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button type="button" className="icon-btn" onClick={onHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
      </div>
    </header>
  );
}
