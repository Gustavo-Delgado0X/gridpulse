import type { Opportunity, ProjectRef } from "../types";
import { UtilityChip } from "./UtilityChip";

const DAY = 86_400_000;
const time = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

function span(refs: ProjectRef[]): [number, number] {
  const dates = refs.flatMap((r) => [r.window_start, r.window_end, r.in_service_date]).filter(Boolean).map((d) => time(d!));
  const pad = 120 * DAY;
  return [Math.min(...dates) - pad, Math.max(...dates) + pad];
}

const MAX_YEAR_LABELS = 6;

/** Year ticks for the axis; every other year (even years) once the span gets long. */
export function yearLabels(first: number, last: number): number[] {
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return all.length <= MAX_YEAR_LABELS ? all : all.filter((y) => y % 2 === 0);
}

/** Build-window bars only where the source gives them; otherwise a date marker (contracts §5 U7). */
export function TimelineStrip({ opportunity }: { opportunity: Opportunity }) {
  const refs = [opportunity.a, opportunity.b];
  const [lo, hi] = span(refs);
  const pct = (iso: string) => `${((time(iso) - lo) / (hi - lo)) * 100}%`;
  const years = yearLabels(new Date(lo).getUTCFullYear() + 1, new Date(hi).getUTCFullYear());

  return (
    <section className="timeline" aria-label="Timeline">
      <header className="section-head">
        <span className="tag">TIMELINE</span>
        {opportunity.window_overlap_days ? <span className="tag tag--accent">WINDOW OVERLAP · {opportunity.window_overlap_days} DAYS</span> : null}
        <span className="tag tag--muted">IN-SERVICE GAP · {opportunity.in_service_gap_days} DAYS</span>
      </header>
      <div className="timeline__track">
        {years.map((y) => <span key={y} className="timeline__year mono" style={{ left: pct(`${y}-01-01`) }}>{y}</span>)}
        {refs.map((r, i) => (
          <div key={r.id} className="timeline__row" style={{ top: `${22 + i * 26}px` }}>
            {r.window_start && r.window_end && (
              <span className={`timeline__bar timeline__bar--${r.utility}`}
                    style={{ left: pct(r.window_start), width: `calc(${pct(r.window_end)} - ${pct(r.window_start)})` }}
                    title={`${r.utility} build window ${r.window_start} → ${r.window_end}`} />
            )}
            <span className={`timeline__marker timeline__marker--${r.utility}`} style={{ left: pct(r.in_service_date) }}
                  title={`${r.utility} in service ${r.in_service_date}`} />
            <span className="timeline__label"><UtilityChip utility={r.utility} /></span>
          </div>
        ))}
      </div>
      <p className="muted small">Bars: DESC spend years (public cost schedule) and GPC start → need date. Marker: in-service / need date.</p>
    </section>
  );
}
