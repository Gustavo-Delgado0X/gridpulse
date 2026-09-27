import { useMemo, useState } from "react";
import { changeDelta } from "../delta";
import { pairsFor } from "../filters";
import type { Change, Opportunity } from "../types";
import { UtilityChip } from "./UtilityChip";

const EVENT_TEXT: Record<string, string> = {
  new: "New", removed: "Removed", completed: "Completed", cancelled: "Cancelled", slipped: "Schedule slip",
  moved_earlier: "Moved earlier", renamed: "Renamed", cost_changed: "Cost change", sources_disagree: "Sources disagree", changed: "Changed",
  id_reused: "Project ID reused",
};
const EVENT_GLYPH: Record<string, string> = {
  slipped: "→", moved_earlier: "←", cost_changed: "$", renamed: "Aa", sources_disagree: "▲", new: "+", removed: "−",
  completed: "✓", cancelled: "×", changed: "~", id_reused: "≠",
};
const GROUPS: Record<string, (c: Change) => boolean> = {
  All: () => true,
  Schedule: (c) => c.event === "slipped" || c.event === "moved_earlier",
  Cost: (c) => c.event === "cost_changed",
  Renamed: (c) => c.event === "renamed",
  "Source conflicts": (c) => c.event === "sources_disagree",
  "New projects": (c) => c.event === "new",
  "Removed / completed / cancelled": (c) => ["removed", "completed", "cancelled"].includes(c.event),
  "Change notes": (c) => c.event === "changed",
  "Reused Project IDs": (c) => c.event === "id_reused",
};
const MAIN_GROUPS = ["All", "Schedule", "Cost", "Renamed"];

interface Props {
  changes: Change[];
  opportunities?: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
  initialProjectId?: string | null;
}

const refText = (c: Change) => c.evidence.map((e) => `${e.source_id} p.${e.page}`).join(" → ");

function toCsv(rows: Change[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["project_id", "utility", "name", "event", "before", "after", "evidence"].join(",")];
  for (const c of rows) lines.push([c.project_id, c.utility, c.name, c.event, c.before, c.after, refText(c)].map(esc).join(","));
  return lines.join("\n");
}

export function PlanChangesView({ changes, opportunities = [], onOpenOpportunity, initialProjectId = null }: Props) {
  const [group, setGroup] = useState<string>("All");
  const [utility, setUtility] = useState<"All" | "DESC" | "GPC">("All");
  const [query, setQuery] = useState(initialProjectId ?? "");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [open, setOpen] = useState<Change | null>(null);

  const linked = useMemo(() => new Set(opportunities.flatMap((o) => [o.a.id, o.b.id])), [opportunities]);
  const ranked = (c: Change) => c.primary_id ?? c.project_id; // the id opportunities use
  const shown = useMemo(() => changes.filter((c) =>
    GROUPS[group](c) && (utility === "All" || c.utility === utility) && (!linkedOnly || linked.has(ranked(c))) &&
    (!query || `${c.name} ${c.project_id} ${c.primary_id ?? ""}`.toLowerCase().includes(query.toLowerCase()))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [changes, group, utility, linkedOnly, linked, query]);
  const byProject = useMemo(() => {
    const map = new Map<string, Change[]>();
    for (const c of shown) map.set(c.project_id, [...(map.get(c.project_id) ?? []), c]);
    return [...map.entries()];
  }, [shown]);
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(shown))}`;
  const openPairs = open ? pairsFor(ranked(open), opportunities) : [];
  const openDelta = open ? changeDelta(open.before, open.after) : null;

  return (
    <main className="page page--changes" aria-label="Plan changes">
      <section className="toolbar">
        <div>
          <h1 className="page-title">Plan changes</h1>
          <p className="muted small">{shown.length} of {changes.length} changes · {byProject.length} projects · desc-2428 → desc-2529 → desc-2630, GPC IRP tables, SERTP</p>
        </div>
        <label className="search search--grow">
          <span className="search__icon" aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search changes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search changes" />
        </label>
        <div className="segmented" role="group" aria-label="Change type">
          {MAIN_GROUPS.map((g) => (
            <button key={g} type="button" className="segmented__item" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
        <select className="select" aria-label="More change types" value={MAIN_GROUPS.includes(group) ? "" : group}
                onChange={(e) => setGroup(e.target.value || "All")}>
          <option value="">More…</option>
          {Object.keys(GROUPS).filter((g) => !MAIN_GROUPS.includes(g)).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Utility">
          {(["All", "DESC", "GPC"] as const).map((u) => (
            <button key={u} type="button" className="segmented__item" aria-pressed={utility === u} onClick={() => setUtility(u)}>{u}</button>
          ))}
        </div>
        <label className="check check--btn"><input type="checkbox" checked={linkedOnly} onChange={() => setLinkedOnly((l) => !l)} /> Linked only</label>
        <a className="btn" href={csvHref} download="gridpulse_plan_changes.csv">Export CSV</a>
      </section>
      <div className={`changes-layout ${open ? "has-drawer" : ""}`}>
        <div className="changes-table" role="table" aria-label="Changes grouped by project">
          <div className="changes-row changes-row--head" role="row">
            <span role="columnheader">Project</span><span role="columnheader">Change</span><span role="columnheader">Before → after</span>
            <span role="columnheader">Delta</span><span role="columnheader">Evidence</span>
          </div>
          {byProject.length === 0 && <div className="empty"><p className="empty__title">No changes match</p></div>}
          {byProject.map(([projectId, rows]) => {
            const pairs = pairsFor(ranked(rows[0]), opportunities);
            return (
              <div key={projectId} className="changes-group" role="rowgroup">
                <div className="changes-group__project">
                  <p><UtilityChip utility={rows[0].utility} /> <span className="muted">· {rows.length} {rows.length === 1 ? "change" : "changes"}</span></p>
                  <p className="changes-group__name">{rows[0].name}</p>
                  {pairs.length > 0 && onOpenOpportunity && (
                    <button type="button" className="link-btn" onClick={() => onOpenOpportunity(pairs[0].id)}>
                      {pairs.length} {pairs.length === 1 ? "opportunity" : "opportunities"} →
                    </button>
                  )}
                </div>
                <div className="changes-group__rows">
                  {rows.map((c, i) => {
                    const delta = changeDelta(c.before, c.after);
                    return (
                      <button key={`${c.event}-${i}`} type="button" role="row" className={`changes-row ${open === c ? "is-selected" : ""}`} onClick={() => setOpen(c)}>
                        <span role="cell" className="change-kind"><span className="glyph" aria-hidden="true">{EVENT_GLYPH[c.event] ?? "•"}</span>{EVENT_TEXT[c.event] ?? c.event}</span>
                        <span role="cell" className="before-after"><span className="muted">{c.before ?? "—"}</span> <span aria-hidden="true">→</span> <strong>{c.after ?? "—"}</strong></span>
                        <span role="cell" className={`delta delta--${delta?.tone ?? "none"}`}>{delta ? <><strong>{delta.main}</strong><span>{delta.sub}</span></> : ""}</span>
                        <span role="cell" className="refs mono">{c.evidence.map((e, j) => <span key={j}>{j > 0 ? "→ " : ""}{e.source_id} p.{e.page}</span>)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {open && (
          <aside className="drawer" aria-label="Change detail">
            <header className="drawer__head">
              <div><p><UtilityChip utility={open.utility} /> <span className="mono muted">{open.project_id}</span></p>
                <h2 className="panel-title">{open.name}</h2></div>
              <button type="button" className="icon-btn" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </header>
            <p className="change-kind"><span className="glyph" aria-hidden="true">{EVENT_GLYPH[open.event] ?? "•"}</span>{EVENT_TEXT[open.event] ?? open.event}</p>
            <dl className="stats stats--3">
              <div><dt>Previous</dt><dd>{open.before ?? "—"}</dd></div>
              <div><dt>Current</dt><dd>{open.after ?? "—"}</dd></div>
              <div><dt>Difference</dt><dd className={`delta--${openDelta?.tone ?? "none"}`}>{openDelta ? openDelta.main : "—"}</dd></div>
            </dl>
            <h3 className="section-title">Source comparison</h3>
            <div className="compare__grid">
              {open.evidence.map((e, i) => (
                <div key={`${e.source_id}-${i}`} className="compare__cell"><span className="compare__label mono">{e.source_id} · p.{e.page}</span><span>{e.quote}</span></div>
              ))}
            </div>
            {changes.filter((c) => c.project_id === open.project_id && c !== open).length > 0 && (
              <>
                <h3 className="section-title">Other changes to this project</h3>
                <ul className="plain-list">
                  {changes.filter((c) => c.project_id === open.project_id && c !== open).map((c, i) => (
                    <li key={i}><button type="button" className="link-btn" onClick={() => setOpen(c)}>{EVENT_TEXT[c.event] ?? c.event}: {c.before ?? "—"} → {c.after ?? "—"}</button></li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="section-title">Affected opportunities</h3>
            {openPairs.length === 0 ? <p className="muted">None within the current radius.</p> : (
              <ul className="plain-list">
                {openPairs.map((o) => (
                  <li key={o.id}><button type="button" className="link-btn" onClick={() => onOpenOpportunity?.(o.id)}>#{o.rank} · {o.tier ?? "—"} · {o.a.name} × {o.b.name} →</button></li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
