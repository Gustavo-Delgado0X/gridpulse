import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { EMPTY_FILTERS, isFiltered, toggleTier, type Filters } from "../filters";
import { FLAG_TEXT, TIER_TEXT, TIMING_SHORT, TIMING_TEXT } from "../format";
import type { Opportunity, Tier, Triage } from "../types";
import { TierBadge } from "./TierBadge";
import { UtilityChip } from "./UtilityChip";

type SortKey = "rank" | "dist_closest_mi" | "dist_center_mi" | "in_service_gap_days";

const COLUMNS: Record<SortKey, string> = {
  rank: "#", dist_closest_mi: "Closest mi", dist_center_mi: "Center mi", in_service_gap_days: "Day gap",
};
const TIERS: Tier[] = ["T1", "T2", "T3", "T4"];

interface Props {
  items: Opportunity[];
  total: number;
  filters: Filters;
  onFilters: (next: Filters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  triage: Record<string, Triage>;
}

export function OpportunityTable({ items, total, filters, onFilters, selectedId, onSelect, onHover, triage }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [compact, setCompact] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const rows = useMemo(() => items.toSorted((x, y) => (x[sort.key] - y[sort.key]) * sort.dir), [items, sort]);

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

  const move = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (event.key === "Enter") onSelect(rows[index].id);
    if (!step) return;
    event.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, index + step))];
    onSelect(next.id);
    rowRefs.current.get(next.id)?.focus();
  };

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : 1 }));

  const sortButton = (key: SortKey) => {
    const active = sort.key === key;
    return (
      <button type="button" className="sort" onClick={() => toggleSort(key)}
              aria-label={`${COLUMNS[key]}${active ? (sort.dir === 1 ? ", sorted ascending" : ", sorted descending") : ""}`}>
        {COLUMNS[key]}{active ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    );
  };

  return (
    <section className="panel table-panel" aria-label="Ranked opportunities">
      <div className="table-tools">
        <input ref={search} type="search" className="input" placeholder="Filter pairs  ( / )" value={filters.query}
               onChange={(e) => onFilters({ ...filters, query: e.target.value })} aria-label="Filter opportunities" />
        <div className="chips" role="group" aria-label="Tier filter">
          {TIERS.map((t) => (
            <button key={t} type="button" className={`chip-btn tier-chip tier-chip--${t}`} aria-pressed={filters.tiers.includes(t)}
                    aria-label={`Show ${t} only`} title={`${t} · ${TIER_TEXT[t]}`} onClick={() => onFilters(toggleTier(filters, t))}>
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--sm density" aria-pressed={compact} onClick={() => setCompact((c) => !c)}
                title="Row density">{compact ? "Comfortable" : "Compact"}</button>
      </div>
      {isFiltered(filters) && rows.length > 0 && (
        <p className="filter-note small">
          Showing <span className="mono">{items.length}</span> of <span className="mono">{total}</span>
          <button type="button" className="link-btn" onClick={() => onFilters(EMPTY_FILTERS)}>Clear filters</button>
        </p>
      )}
      {rows.length === 0 ? (
        isFiltered(filters) ? (
          <div className="empty"><span className="tag">NO PAIRS MATCH THESE FILTERS</span>
            <p><button type="button" className="btn btn--ghost" onClick={() => onFilters(EMPTY_FILTERS)}>Clear filters</button></p></div>
        ) : (
          <div className="empty"><span className="tag">NO OVERLAPS AT THIS THRESHOLD</span><p>Widen the distance slider.</p></div>
        )
      ) : (
        <div className="table-scroll" onMouseLeave={() => onHover(null)}>
          <table className={`table ${compact ? "table--compact" : ""}`}>
            <thead>
              <tr>
                <th scope="col">{sortButton("rank")}</th>
                <th scope="col">Tier</th>
                <th scope="col">Pair</th>
                <th scope="col" className="num">{sortButton("dist_closest_mi")}</th>
                <th scope="col" className="num opt">{sortButton("dist_center_mi")}</th>
                <th scope="col">Timing</th>
                <th scope="col" className="num opt">{sortButton("in_service_gap_days")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o, index) => (
                <tr key={o.id} ref={(el) => { if (el) rowRefs.current.set(o.id, el); else rowRefs.current.delete(o.id); }}
                    tabIndex={0} aria-selected={o.id === selectedId}
                    className={`${o.id === selectedId ? "is-selected" : ""} triage--${triage[o.id] ?? "new"}`}
                    onClick={() => onSelect(o.id)} onKeyDown={(e) => move(e, index)} onMouseEnter={() => onHover(o.id)}
                    onFocus={() => onHover(o.id)}>
                  <td className="num mono">{o.rank}</td>
                  <td><TierBadge tier={o.tier} compact /></td>
                  <td>
                    <div className="pair">
                      <span className="pair__line" title={o.a.name}><UtilityChip utility={o.a.utility} /><span className="pair__name">{o.a.name}</span></span>
                      <span className="pair__line" title={o.b.name}><UtilityChip utility={o.b.utility} /><span className="pair__name">{o.b.name}</span></span>
                      {(o.flags.length > 0 || (triage[o.id] && triage[o.id] !== "new")) && (
                        <span className="pair__flags">
                          {o.flags.map((f) => <span key={f} className="tag tag--warn tag--xs">{FLAG_TEXT[f] ?? f}</span>)}
                          {triage[o.id] && triage[o.id] !== "new" && <span className="tag tag--muted tag--xs">{triage[o.id].toUpperCase()}</span>}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="num mono">{o.touching ? "0.00" : o.dist_closest_mi.toFixed(2)}</td>
                  <td className="num mono opt">{o.dist_center_mi.toFixed(2)}</td>
                  <td><span className={`timing timing--${o.timeline_label}`} title={TIMING_TEXT[o.timeline_label]}>{TIMING_SHORT[o.timeline_label]}</span></td>
                  <td className="num mono opt">{o.in_service_gap_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
