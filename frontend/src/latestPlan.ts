// "Coordination now": pairs ranked on each project's latest published in-service date, so work that is already
// finished drops out. DESC dates come from the newest list edition that changed them (2025-29 or 2026-30);
// Georgia Power's latest plan is the 2025 IRP. Locations and the six-case benchmark are unchanged.
import type { Change, Opportunity } from "./types";

const DAY = 86_400_000;
const PLAN: Record<string, string> = {
  "desc-2428": "DESC 2024–28", "desc-2529": "DESC 2025–29", "desc-2630": "DESC 2026–30", "gpc-irp25-v3": "GPC IRP 2025",
};
const TIER_ORDER: Record<string, number> = { T1: 0, T2: 1, T3: 2, T4: 3 };

export const planLabel = (sourceId: string) => PLAN[sourceId] ?? sourceId;

/** Project id (as ranked) -> the date and edition of its newest schedule change. Editions sort by id (desc-2428 < 2529 < 2630). */
export function latestDates(changes: Change[]): Map<string, { date: string; source: string }> {
  const latest = new Map<string, { date: string; source: string }>();
  for (const c of changes) {
    if ((c.event !== "slipped" && c.event !== "moved_earlier") || !c.after || !c.primary_id) continue;
    const source = c.evidence[c.evidence.length - 1]?.source_id ?? "";
    const seen = latest.get(c.primary_id);
    if (!seen || source > seen.source) latest.set(c.primary_id, { date: c.after, source });
  }
  return latest;
}

export interface NowRow {
  opportunity: Opportunity;
  a: { date: string; plan: string; changed: boolean };
  b: { date: string; plan: string; changed: boolean };
  gapDays: number;
}

export function coordinationNow(opps: Opportunity[], changes: Change[], today: string): NowRow[] {
  const latest = latestDates(changes);
  const side = (ref: Opportunity["a"]) => {
    const newer = latest.get(ref.id);
    return { date: newer?.date ?? ref.in_service_date, plan: planLabel(newer?.source ?? ref.source_id), changed: Boolean(newer) };
  };
  return opps
    .map((o) => {
      const a = side(o.a), b = side(o.b);
      const gapDays = Math.round(Math.abs(Date.parse(a.date) - Date.parse(b.date)) / DAY);
      return { opportunity: o, a, b, gapDays };
    })
    .filter((r) => r.a.date >= today && r.b.date >= today)
    .sort((x, y) => x.gapDays - y.gapDays
      || (TIER_ORDER[x.opportunity.tier ?? ""] ?? 9) - (TIER_ORDER[y.opportunity.tier ?? ""] ?? 9)
      || x.opportunity.rank - y.opportunity.rank);
}
