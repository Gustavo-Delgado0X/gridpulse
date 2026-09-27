import { useMemo, useState } from "react";
import type { Change } from "../types";
import { UtilityChip } from "./UtilityChip";

const EVENT_TEXT: Record<string, string> = {
  new: "NEW", removed: "REMOVED", completed: "COMPLETED", cancelled: "CANCELLED", slipped: "SLIPPED",
  moved_earlier: "MOVED EARLIER", renamed: "RENAMED", cost_changed: "COST CHANGED", sources_disagree: "SOURCES DISAGREE",
};

export function PlanChangesView({ changes }: { changes: Change[] }) {
  const [event, setEvent] = useState<string>("all");
  const events = useMemo(() => [...new Set(changes.map((c) => c.event))].sort(), [changes]);
  const shown = event === "all" ? changes : changes.filter((c) => c.event === event);

  return (
    <section className="view" aria-label="Plan changes">
      <div className="panel">
        <header className="section-head">
          <h2 className="panel-title">What changed between plan versions</h2>
          <label className="field field--inline"><span className="field__label">Event</span>
            <select className="input" value={event} onChange={(e) => setEvent(e.target.value)}>
              <option value="all">All ({changes.length})</option>
              {events.map((e) => <option key={e} value={e}>{EVENT_TEXT[e] ?? e} ({changes.filter((c) => c.event === e).length})</option>)}
            </select>
          </label>
        </header>
        {shown.length === 0 ? <div className="empty"><span className="tag">NO CHANGES</span></div> : (
          <table className="table table--compact">
            <thead><tr><th scope="col">Event</th><th scope="col">Utility</th><th scope="col">Project</th>
              <th scope="col">Before → after</th><th scope="col">Evidence</th></tr></thead>
            <tbody>
              {shown.map((c, i) => (
                <tr key={`${c.project_id}-${c.event}-${i}`}>
                  <td><span className={`tag event event--${c.event}`}>{EVENT_TEXT[c.event] ?? c.event.toUpperCase()}</span></td>
                  <td><UtilityChip utility={c.utility} /></td>
                  <td>{c.name}</td>
                  <td className="mono">{c.before ?? "—"} → {c.after ?? "—"}</td>
                  <td className="mono small">{c.evidence.map((e) => `${e.source_id} p.${e.page}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
