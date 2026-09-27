import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { activeChips, EMPTY_FILTERS, isFiltered, toggleIn, toggleTier, type Filters } from "../filters";
import { TIER_TEXT } from "../format";
import type { Method, Opportunity, Tier, Triage } from "../types";
import { Popover } from "./Popover";
import { TierBadge } from "./TierBadge";
import { UtilityChip } from "./UtilityChip";

type SortKey = "rank" | "distance" | "overlap";
const TIERS: Tier[] = ["T1", "T2", "T3", "T4"];
const TRIAGE: Triage[] = ["new", "reviewed", "contacted", "dismissed"];
export const TIER_RANGE: Record<Tier, string> = { T1: "Touching", T2: "< 1 mi", T3: "< 5 mi", T4: "≤ 25 mi" };

export function tierLine(o: Pick<Opportunity, "tier">): string {
  if (!o.tier) return "Beyond 25 mi";
  const meaning = TIER_TEXT[o.tier].toLowerCase();
  return `${TIER_RANGE[o.tier]} · ${meaning[0].toUpperCase()}${meaning.slice(1)}`;
}

interface Props {
  items: Opportunity[];
  total: number;
  filters: Filters;
  onFilters: (next: Filters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  triage: Record<string, Triage>;
  method?: Method;
  distance?: number;
  onWiden?: () => void;
  csvUrl?: string;
  projectName?: string;
}

const SORTS: Record<SortKey, (a: Opportunity, b: Opportunity) => number> = {
  rank: (a, b) => a.rank - b.rank,
  distance: (a, b) => (a.touching ? 0 : a.dist_closest_mi) - (b.touching ? 0 : b.dist_closest_mi) || a.rank - b.rank,
  overlap: (a, b) => (b.window_overlap_days ?? 0) - (a.window_overlap_days ?? 0) || a.rank - b.rank,
};

function Row({ o, index, selected, compact, status, onSelect, onHover, onKey, refFn }: {
  o: Opportunity; index: number; selected: boolean; compact: boolean; status: Triage;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
  onKey: (e: KeyboardEvent<HTMLLIElement>, index: number) => void; refFn: (el: HTMLLIElement | null) => void;
}) {
  const overlap = o.window_overlap_days ? `${o.window_overlap_days}-day overlap` : "No overlap";
  return (
    <li ref={refFn} role="option" tabIndex={selected ? 0 : -1} aria-selected={selected}
        className={`qrow ${selected ? "is-selected" : ""} ${compact ? "qrow--compact" : ""} triage--${status}`}
        onClick={() => onSelect(o.id)} onKeyDown={(e) => onKey(e, index)} onMouseEnter={() => onHover(o.id)} onFocus={() => onHover(o.id)}>
      <span className="qrow__rank">#{o.rank}</span>
      <div className="qrow__body">
        <div className="qrow__head">
          <TierBadge tier={o.tier} compact />
          <span className="qrow__tier">{tierLine(o)}</span>
          {status !== "new" && <span className="triage-tag">{status[0].toUpperCase() + status.slice(1)}</span>}
        </div>
        <p className="qrow__proj" title={o.a.name}><UtilityChip utility={o.a.utility} /><span className="clamp">{o.a.name}</span></p>
        <p className="qrow__proj" title={o.b.name}><UtilityChip utility={o.b.utility} /><span className="clamp">{o.b.name}</span></p>
        <p className="qrow__meta">
          <strong>{o.touching ? "0.00 mi" : `${o.dist_closest_mi.toFixed(2)} mi`}</strong> closest
          <span className="sep">·</span>{overlap}<span className="sep">·</span>{o.in_service_gap_days} d in-service gap
        </p>
        {o.flags.includes("sources_disagree") && <p className="qrow__note qrow__note--warn">▲ Source conflict · plan documents disagree on a date</p>}
        {o.flags.includes("low_confidence_location") && <p className="qrow__note">◇ Approximate endpoint location</p>}
      </div>
    </li>
  );
}

export function OpportunityTable({ items, total, filters, onFilters, selectedId, onSelect, onHover, triage, method = "closest",
  distance = 25, onWiden, csvUrl, projectName }: Props) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [compact, setCompact] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const rows = useMemo(() => items.toSorted(SORTS[sort]), [items, sort]);
  const chips = activeChips(filters, projectName);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  const move = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (event.key === "Enter") onSelect(rows[index].id);
    if (!step) return;
    event.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, index + step))];
    onSelect(next.id);
    rowRefs.current.get(next.id)?.focus();
  };

  const check = (checked: boolean, label: string, onChange: () => void, key: string) => (
    <label key={key} className="check"><input type="checkbox" checked={checked} onChange={onChange} /> {label}</label>
  );

  return (
    <section className="queue" aria-label="Ranked opportunities">
      <header className="queue__head">
        <h2 className="panel-title">Opportunities</h2>
        <span className="muted">{items.length} candidates</span>
        <span className="spacer" />
        <button type="button" className="btn btn--quiet" aria-pressed={compact} onClick={() => setCompact((c) => !c)}>
          {compact ? "Comfortable" : "Compact"}
        </button>
        {csvUrl && <a className="btn" href={csvUrl} download>Export CSV</a>}
      </header>
      <div className="queue__tools">
        <label className="search search--inline">
          <span className="search__icon" aria-hidden="true">⌕</span>
          <input ref={search} type="search" placeholder="Filter by project name" value={filters.query}
                 onChange={(e) => onFilters({ ...filters, query: e.target.value })} aria-label="Filter opportunities" />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <Popover label={`Filter${chips.length ? ` · ${chips.length}` : ""}`} ariaLabel="Filter opportunities">
          {() => (
            <div className="filter-menu">
              <fieldset><legend>Tier</legend>
                {TIERS.map((t) => check(filters.tiers.includes(t), `${t} · ${TIER_RANGE[t]}`, () => onFilters(toggleTier(filters, t)), t))}
              </fieldset>
              <fieldset><legend>Timing and sources</legend>
                {check(filters.sameWindowOnly, "Build windows overlap", () => onFilters({ ...filters, sameWindowOnly: !filters.sameWindowOnly }), "w")}
                {check(filters.flags.includes("sources_disagree"), "Source conflict", () => onFilters({ ...filters, flags: toggleIn(filters.flags, "sources_disagree") }), "sd")}
                {check(filters.flags.includes("low_confidence_location"), "Approximate location", () => onFilters({ ...filters, flags: toggleIn(filters.flags, "low_confidence_location") }), "lc")}
              </fieldset>
              <fieldset><legend>Review status</legend>
                {TRIAGE.map((t) => check(filters.triage.includes(t), t[0].toUpperCase() + t.slice(1), () => onFilters({ ...filters, triage: toggleIn(filters.triage, t) }), t))}
              </fieldset>
            </div>
          )}
        </Popover>
        <label className="sort-select">
          <span className="sr-only">Sort</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort opportunities">
            <option value="rank">Sort: Rank</option>
            <option value="distance">Sort: Distance</option>
            <option value="overlap">Sort: Overlap</option>
          </select>
        </label>
      </div>
      {chips.length > 0 && (
        <div className="chips-row">
          {chips.map((c) => (
            <button key={c.key} type="button" className="fchip" onClick={() => onFilters(c.remove(filters))} aria-label={`Remove filter ${c.label}`}>
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-btn" onClick={() => onFilters(EMPTY_FILTERS)}>Clear all</button>
          <span className="muted small">{items.length} of {total}</span>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty__title">No opportunities match</p>
          <p className="muted">{isFiltered(filters) ? "Your filters hide every pair" : "No DESC × GPC pairs"} within {distance} mi
            ({method === "closest" ? "closest points" : "project centers"}).</p>
          <div className="empty__actions">
            {isFiltered(filters) && <button type="button" className="btn" onClick={() => onFilters(EMPTY_FILTERS)}>Clear filters</button>}
            {onWiden && distance < 50 && <button type="button" className="btn" onClick={onWiden}>Widen radius to 50 mi</button>}
          </div>
        </div>
      ) : (
        <ul className="queue__list" role="listbox" aria-label="Opportunities" onMouseLeave={() => onHover(null)}>
          {rows.map((o, index) => (
            <Row key={o.id} o={o} index={index} selected={o.id === selectedId} compact={compact} status={triage[o.id] ?? "new"}
                 onSelect={onSelect} onHover={onHover} onKey={move}
                 refFn={(el) => { if (el) rowRefs.current.set(o.id, el); else rowRefs.current.delete(o.id); }} />
          ))}
        </ul>
      )}
    </section>
  );
}
