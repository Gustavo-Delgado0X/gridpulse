import type { Quality } from "../types";
import { Popover } from "./Popover";

export type View = "opportunities" | "changes" | "quality";
export type Theme = "light" | "dark";

interface Props {
  view: View;
  onView: (v: View) => void;
  counts: { opportunities: number | null; changes: number | null; issues: number | null };
  query: string;
  onQuery: (q: string) => void;
  acceptance: Quality["acceptance"] | null;
  dataMode: string | null;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onHelp: () => void;
}

const VIEWS: { id: View; label: string; count: keyof Props["counts"] }[] = [
  { id: "opportunities", label: "Opportunities", count: "opportunities" },
  { id: "changes", label: "Plan changes", count: "changes" },
  { id: "quality", label: "Data quality", count: "issues" },
];

export function TopBar({ view, onView, counts, query, onQuery, acceptance, dataMode, theme, onTheme, onHelp }: Props) {
  return (
    <header className="topbar">
      <div className="brand"><span className="brand__mark" aria-hidden="true"><span /></span>GridPulse</div>
      <button type="button" className="btn study-btn" title="Study: Dominion Energy South Carolina × Georgia Power">
        <span className="shape shape--circle chip--DESC" aria-hidden="true" />
        <span className="shape shape--square chip--GPC" aria-hidden="true" />
        DESC × Georgia Power
      </button>
      <nav className="nav" aria-label="Views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className="nav__tab" aria-current={view === v.id ? "page" : undefined} onClick={() => onView(v.id)}>
            {v.label}{counts[v.count] != null && <span className="nav__count">{counts[v.count]}</span>}
          </button>
        ))}
      </nav>
      <span className="spacer" />
      <label className="search">
        <span className="search__icon" aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search projects" value={query} aria-label="Search projects"
               onChange={(e) => { onQuery(e.target.value); if (view !== "opportunities") onView("opportunities"); }} />
      </label>
      {acceptance && (
        <button type="button" className={`validated ${acceptance.passed ? "is-ok" : "is-fail"}`} onClick={() => onView("quality")}
                title="Sperry's six answer-key overlaps reproduced to ±0.01 mi">
          <span className="dot" aria-hidden="true" />{acceptance.passed ? "Validated" : "Validation failed"} {acceptance.matched}/{acceptance.expected}
        </button>
      )}
      <span className="pill" title="Dataset status">{dataMode === "db" ? "Live DB" : "Seed dataset"}</span>
      <button type="button" className="icon-btn" onClick={onHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
      <Popover label={<span aria-hidden="true">⚙</span>} ariaLabel="Settings" align="right" className="settings">
        {(close) => (
          <div className="menu" role="menu">
            <p className="menu__label">Theme</p>
            {(["light", "dark"] as Theme[]).map((t) => (
              <button key={t} type="button" role="menuitemradio" aria-checked={theme === t} className="menu__item"
                      onClick={() => { onTheme(t); close(); }}>
                <span className="menu__check" aria-hidden="true">{theme === t ? "✓" : ""}</span>{t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </header>
  );
}
