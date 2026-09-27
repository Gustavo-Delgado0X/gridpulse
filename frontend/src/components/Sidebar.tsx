import { useEffect, useRef } from "react";
import type { Quality } from "../types";
import { Icon, type IconName } from "./Icon";
import { Popover } from "./Popover";

export type View = "opportunities" | "changes" | "quality";
export type Theme = "light" | "dark";

interface Props {
  view: View;
  onView: (v: View) => void;
  counts: { opportunities: number | null; changes: number | null; issues: number | null };
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  acceptance: Quality["acceptance"] | null;
  dataMode: string | null;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onHelp: () => void;
}

const VIEWS: { id: View; label: string; icon: IconName; count: keyof Props["counts"] }[] = [
  { id: "opportunities", label: "Opportunities", icon: "pairs", count: "opportunities" },
  { id: "changes", label: "Plan changes", icon: "changes", count: "changes" },
  { id: "quality", label: "Data quality", icon: "quality", count: "issues" },
];

/** Collapsible primary navigation (two-column design). Collapsed, every control keeps its accessible name. */
export function Sidebar({ view, onView, counts, collapsed, onCollapse, query, onQuery, acceptance, dataMode, theme, onTheme, onHelp }: Props) {
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onCollapse(false);
      requestAnimationFrame(() => search.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCollapse]);

  const expandAndSearch = () => { onCollapse(false); requestAnimationFrame(() => search.current?.focus()); };

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Primary">
      <div className="sidebar__head">
        <a className="brand" href="/" title="GridPulse home"><span className="brand__mark" aria-hidden="true"><span /></span>
          <span className="sidebar__text">GridPulse</span></a>
        <button type="button" className="icon-btn icon-btn--bare" onClick={() => onCollapse(!collapsed)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          <Icon name="sidebar" />
        </button>
      </div>

      <div className="sidebar__section">
        <p className="sidebar__label sidebar__text">Study</p>
        {/* One study today, so this names it rather than pretending to switch studies. */}
        <p className="sidebar__item sidebar__study" title="Study: Dominion Energy South Carolina × Georgia Power · Savannah / Augusta">
          <span className="study-mark" aria-hidden="true"><span className="shape shape--circle chip--DESC" /><span className="shape shape--square chip--GPC" /></span>
          <span className={collapsed ? "sr-only" : "sidebar__text"}>DESC × Georgia Power</span>
        </p>
        {collapsed ? (
          <button type="button" className="sidebar__item" onClick={expandAndSearch} aria-label="Search projects"><Icon name="search" /></button>
        ) : (
          <label className="search sidebar__search">
            <Icon name="search" />
            <input ref={search} type="search" placeholder="Search projects" value={query} aria-label="Search projects"
                   onChange={(e) => { onQuery(e.target.value); if (view !== "opportunities") onView("opportunities"); }} />
            <kbd aria-hidden="true">⌘K</kbd>
          </label>
        )}
      </div>

      <nav className="sidebar__section" aria-label="Workspace">
        <p className="sidebar__label sidebar__text">Workspace</p>
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className="sidebar__item sidebar__nav" aria-current={view === v.id ? "page" : undefined}
                  onClick={() => onView(v.id)} title={collapsed ? v.label : undefined}>
            <Icon name={v.icon} />
            <span className="sidebar__text">{v.label}</span>
            {counts[v.count] != null && <span className="sidebar__count">{counts[v.count]}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar__foot">
        {acceptance && (
          <button type="button" className={`sidebar__item validated ${acceptance.passed ? "is-ok" : "is-fail"}`} onClick={() => onView("quality")}
                  title="Distance math reproduces Sperry's answer-key distances to ±0.01 mi (checked on the key's coordinates; never used as locations)">
            <span className="dot" aria-hidden="true" />
            <span className="sidebar__text">{acceptance.passed ? "Validated" : "Validation failed"}</span>{" "}
            <span className={collapsed ? "sr-only" : ""}>{acceptance.matched}/{acceptance.expected}</span>
          </button>
        )}
        <p className="sidebar__item sidebar__status" title="Dataset: committed seed data built from the public PDFs">
          <span className="status-square" aria-hidden="true" /><span className="sidebar__text">{dataMode === "db" ? "Live database" : "Seed dataset"}</span>
          {collapsed && <span className="sr-only">{dataMode === "db" ? "Live database" : "Seed dataset"}</span>}
        </p>
        <button type="button" className="sidebar__item" onClick={onHelp} aria-label="Help and keyboard shortcuts">
          <Icon name="help" /><span className="sidebar__text">Help &amp; shortcuts</span>
        </button>
        <Popover label={<><Icon name="gear" /><span className="sidebar__text">Settings</span></>} ariaLabel="Settings" className="sidebar__settings" align="left" up>
          {(close) => (
            <div className="menu" role="menu">
              <p className="menu__label">Theme</p>
              {(["light", "dark"] as Theme[]).map((t) => (
                <button key={t} type="button" role="menuitemradio" aria-checked={theme === t} className="menu__item" onClick={() => { onTheme(t); close(); }}>
                  <span className="menu__check" aria-hidden="true">{theme === t ? "✓" : ""}</span>{t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          )}
        </Popover>
      </div>
    </aside>
  );
}
