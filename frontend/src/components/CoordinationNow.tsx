import { coordinationNow } from "../latestPlan";
import type { Change, Opportunity } from "../types";
import { TierBadge } from "./TierBadge";
import { UtilityChip } from "./UtilityChip";

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

interface Props {
  opportunities: Opportunity[];
  changes: Change[];
  today: string;
  onOpen: (id: string) => void;
}

/** Pairs whose work is still ahead in the latest published plans, closest dates first. */
export function CoordinationNow({ opportunities, changes, today, onOpen }: Props) {
  const rows = coordinationNow(opportunities, changes, today);
  return (
    <section className="queue now" aria-label="Coordination now">
      <header className="queue__head now__head">
        <h2 className="panel-title">Coordination now</h2>
        <span className="muted">{rows.length} pairs</span>
      </header>
      <p className="now__note small muted">Ranked on each project's latest published date: DESC's newest list that changed it (2025–29 or
        2026–30), otherwise DESC 2024–28, and Georgia Power's 2025 IRP. Pairs already in service as of {day(today)} are left out.
        Locations and the six-case benchmark are unchanged.</p>
      {rows.length === 0 ? <p className="empty muted">No pairs still ahead in the latest plans.</p> : (
        <ol className="queue__list now__list">
          {rows.map(({ opportunity: o, a, b, gapDays }) => (
            <li key={o.id} className="qrow now__row">
              <span className="qrow__rank">#{o.rank}</span>
              <div className="qrow__body">
                <div className="qrow__head"><TierBadge tier={o.tier} compact />
                  <span className="qrow__tier">{gapDays} days between latest in-service dates</span>
                  <button type="button" className="btn btn--primary btn--xs qrow__open" onClick={() => onOpen(o.id)}
                          aria-label={`Open details for #${o.rank}`}>Open details <span aria-hidden="true">›</span></button></div>
                <p className="qrow__proj"><UtilityChip utility={o.a.utility} /><span className="clamp">{o.a.name}</span></p>
                <p className="now__plan small"><span className="mono">{a.plan}</span> · in service {day(a.date)}{a.changed && <strong> · date changed in a later DESC list</strong>}</p>
                <p className="qrow__proj"><UtilityChip utility={o.b.utility} /><span className="clamp">{o.b.name}</span></p>
                <p className="now__plan small"><span className="mono">{b.plan}</span> · need date {day(b.date)}</p>
                {o.flags.includes("sources_disagree") && <p className="qrow__note qrow__note--warn">▲ Date conflict · the IRP and SERTP disagree on a date for this pair</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
