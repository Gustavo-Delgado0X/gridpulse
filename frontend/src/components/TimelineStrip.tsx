import type { Opportunity, ProjectRef } from "../types";
import { UtilityChip } from "./UtilityChip";

const DAY = 86_400_000;
const MAX_YEAR_LABELS = 6;
const time = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

/** Year ticks for the axis; every other year (even years) once the span gets long. */
export function yearLabels(first: number, last: number): number[] {
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return all.length <= MAX_YEAR_LABELS ? all : all.filter((y) => y % 2 === 0);
}

export interface PriorDate {
  projectId: string;
  date: string;
  label: string;
}

interface Props {
  opportunity: Opportunity;
  variant?: "compact" | "full";
  priorDates?: PriorDate[];
}

function span(refs: ProjectRef[], extra: string[]): [number, number] {
  const dates = [...refs.flatMap((r) => [r.window_start, r.window_end, r.in_service_date]), ...extra].filter(Boolean).map((d) => time(d!));
  const pad = 120 * DAY;
  return [Math.min(...dates) - pad, Math.max(...dates) + pad];
}

/** Build-window bars only where the source gives them; otherwise a date marker (contracts §5 U7). */
export function TimelineStrip({ opportunity, variant = "compact", priorDates = [] }: Props) {
  const refs = [opportunity.a, opportunity.b];
  const [lo, hi] = span(refs, priorDates.map((p) => p.date));
  const pct = (iso: string) => `${((time(iso) - lo) / (hi - lo)) * 100}%`;
  const years = yearLabels(new Date(lo).getUTCFullYear() + 1, new Date(hi).getUTCFullYear());
  const [a, b] = refs;
  const overlapStart = a.window_start && b.window_start ? (a.window_start > b.window_start ? a.window_start : b.window_start) : null;
  const overlapEnd = a.window_end && b.window_end ? (a.window_end < b.window_end ? a.window_end : b.window_end) : null;
  const hasOverlap = Boolean(opportunity.window_overlap_days && overlapStart && overlapEnd);

  return (
    <section className={`timeline timeline--${variant}`} aria-label="Timeline">
      <div className="timeline__track">
        {years.map((y) => <span key={y} className="timeline__year" style={{ left: pct(`${y}-01-01`) }}>{y}</span>)}
        {hasOverlap && (
          <span className="timeline__band" style={{ left: pct(overlapStart!), width: `calc(${pct(overlapEnd!)} - ${pct(overlapStart!)})` }}
                title={`${opportunity.window_overlap_days}-day overlap`}>
            {variant === "full" && <span className="timeline__band-label">{opportunity.window_overlap_days}-day overlap</span>}
          </span>
        )}
        {refs.map((r, i) => (
          <div key={r.id} className="timeline__row" style={{ top: `${(variant === "full" ? 30 : 22) + i * (variant === "full" ? 34 : 24)}px` }}>
            {r.window_start && r.window_end && (
              <span className={`timeline__bar timeline__bar--${r.utility}`}
                    style={{ left: pct(r.window_start), width: `calc(${pct(r.window_end)} - ${pct(r.window_start)})` }}
                    title={`${r.utility} build window ${r.window_start} → ${r.window_end}`} />
            )}
            <span className="timeline__marker" style={{ left: pct(r.in_service_date) }} title={`${r.utility} in service ${r.in_service_date}`} />
            {priorDates.filter((p) => p.projectId === r.id).map((p) => (
              <span key={p.date} className="timeline__prior" style={{ left: pct(p.date) }} title={`${p.label}: ${p.date}`} />
            ))}
            <span className="timeline__label"><UtilityChip utility={r.utility} /></span>
          </div>
        ))}
      </div>
      {variant === "full" && (
        <table className="mini-table">
          <thead><tr><th scope="col">Project</th><th scope="col">Start</th><th scope="col">In-service</th><th scope="col">Source</th></tr></thead>
          <tbody>
            {refs.map((r) => (
              <tr key={r.id}>
                <td><UtilityChip utility={r.utility} /> <span className="clamp-1" title={r.name}>{r.name}</span></td>
                <td>{r.window_start ?? "—"}</td>
                <td>{r.in_service_date}</td>
                <td className="mono">{r.source_id} p.{r.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">
        Bars: DESC spend years (public cost schedule) and GPC start → need date. Solid tick: in-service date
        {priorDates.length > 0 && <>; dotted tick: a date from an earlier or conflicting source</>}.
      </p>
    </section>
  );
}
