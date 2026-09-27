import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FLAG_TEXT, TIMING_SHORT, TIMING_TEXT } from "../format";
import type { Opportunity, Triage } from "../types";
import { TierBadge } from "./TierBadge";
import { UtilityChip } from "./UtilityChip";

type SortKey = "rank" | "dist_closest_mi" | "dist_center_mi" | "in_service_gap_days";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "#" },
  { key: "dist_closest_mi", label: "Closest mi" },
  { key: "dist_center_mi", label: "Center mi" },
  { key: "in_service_gap_days", label: "Day gap" },
];

interface Props {
  items: Opportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  triage: Record<string, Triage>;
}

function matches(o: Opportunity, query: string): boolean {
  if (!query) return true;
  const haystack = `${o.a.name} ${o.b.name} ${o.a.id} ${o.b.id} ${o.tier ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

export function OpportunityTable({ items, selectedId, onSelect, triage }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [compact, setCompact] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const rows = useMemo(
    () => items.filter((o) => matches(o, query)).toSorted((x, y) => (x[sort.key] - y[sort.key]) * sort.dir),
    [items, query, sort],
  );

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && target.tagName !== "INPUT") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  return (
    <section className="panel table-panel" aria-label="Ranked opportunities">
      <div className="table-tools">
        <input ref={search} type="search" className="input" placeholder="Filter pairs  ( / )" value={query}
               onChange={(e) => setQuery(e.target.value)} aria-label="Filter opportunities" />
        <button type="button" className="btn btn--ghost" aria-pressed={compact} onClick={() => setCompact((c) => !c)}>
          {compact ? "Comfortable" : "Compact"}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><span className="tag">NO OVERLAPS AT THIS THRESHOLD</span>
          <p>Widen the distance slider or clear the filter.</p></div>
      ) : (
        <div className="table-scroll">
          <table className={`table ${compact ? "table--compact" : ""}`}>
            <thead>
              <tr>
                <th scope="col"><SortButton column={COLUMNS[0]} sort={sort} onSort={toggleSort} /></th>
                <th scope="col">Tier</th>
                <th scope="col">Pair</th>
                <th scope="col" className="num"><SortButton column={COLUMNS[1]} sort={sort} onSort={toggleSort} /></th>
                <th scope="col" className="num"><SortButton column={COLUMNS[2]} sort={sort} onSort={toggleSort} /></th>
                <th scope="col">Timing</th>
                <th scope="col" className="num"><SortButton column={COLUMNS[3]} sort={sort} onSort={toggleSort} /></th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o, index) => (
                <tr key={o.id} ref={(el) => { if (el) rowRefs.current.set(o.id, el); else rowRefs.current.delete(o.id); }}
                    tabIndex={0} aria-selected={o.id === selectedId}
                    className={`${o.id === selectedId ? "is-selected" : ""} triage--${triage[o.id] ?? "new"}`}
                    onClick={() => onSelect(o.id)} onKeyDown={(e) => move(e, index)}>
                  <td className="num mono">{o.rank}</td>
                  <td><TierBadge tier={o.tier} compact /></td>
                  <td>
                    <div className="pair">
                      <span className="pair__line" title={o.a.name}><UtilityChip utility={o.a.utility} /><span className="pair__name">{o.a.name}</span></span>
                      <span className="pair__line" title={o.b.name}><UtilityChip utility={o.b.utility} /><span className="pair__name">{o.b.name}</span></span>
                    </div>
                  </td>
                  <td className="num mono">{o.touching ? "0.00" : o.dist_closest_mi.toFixed(2)}</td>
                  <td className="num mono">{o.dist_center_mi.toFixed(2)}</td>
                  <td><span className={`timing timing--${o.timeline_label}`} title={TIMING_TEXT[o.timeline_label]}>{TIMING_SHORT[o.timeline_label]}</span></td>
                  <td className="num mono">{o.in_service_gap_days}</td>
                  <td className="flags">
                    {o.flags.map((f) => <span key={f} className="tag tag--warn">{FLAG_TEXT[f] ?? f}</span>)}
                    {triage[o.id] && triage[o.id] !== "new" && <span className="tag tag--muted">{triage[o.id].toUpperCase()}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SortButton({ column, sort, onSort }: {
  column: { key: SortKey; label: string }; sort: { key: SortKey; dir: 1 | -1 }; onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  return (
    <button type="button" className="sort" onClick={() => onSort(column.key)}
            aria-label={`${column.label}${active ? (sort.dir === 1 ? ", sorted ascending" : ", sorted descending") : ""}`}>
      {column.label}{active ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
    </button>
  );
}
