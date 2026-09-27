// Answers for the voice agent's client tools. Pure functions over live API data: the agent can only say what these
// return, and every source fact keeps its page. Tool names must match scripts/voice_agent.py.
import type { Change, Opportunity, OpportunityDetail, Quality } from "./types";

export const TOOL_NAMES = ["get_study_summary", "list_opportunities", "get_opportunity", "get_plan_changes",
  "get_data_quality", "show_opportunity"] as const;

const MAX_LIST = 10;
const DEFAULT_LIST = 5;
const MAX_CHANGES = 8;
const TIER_MEANING = { T1: "must coordinate", T2: "share land", T3: "share logistics", T4: "share crews" } as const;
const TIMING = { same_window: "build windows overlap", within_1y: "in service within a year of each other", separate: "separate timing" };
const REVIEW = "Every pair is a candidate for human review, not a decision.";

const closest = (o: Opportunity) => (o.touching ? "touching at a shared facility" : `${o.dist_closest_mi.toFixed(2)} miles`);
const cite = (e: { source_id: string; page: number }) => `${e.source_id} page ${e.page}`;

function pairLine(o: Opportunity) {
  return {
    rank: o.rank, tier: o.tier, meaning: o.tier ? TIER_MEANING[o.tier] : "beyond 25 miles",
    desc_project: o.a.name, gpc_project: o.b.name, closest: closest(o),
    timing: TIMING[o.timeline_label], build_window_overlap_days: o.window_overlap_days ?? 0,
    flags: o.flags,
  };
}

export function studySummary(opps: Opportunity[], changes: Change[], quality: Quality) {
  const byTier: Record<string, number> = {};
  for (const o of opps) if (o.tier) byTier[o.tier] = (byTier[o.tier] ?? 0) + 1;
  const { acceptance, independent, coverage } = quality;
  return {
    study: "Dominion Energy South Carolina (DESC) vs Georgia Power (GPC), Savannah and Augusta",
    projects_parsed: coverage.projects, projects_located: coverage.projects_located,
    pairs_within_25_mi: opps.length, pairs_by_tier: byTier,
    pairs_with_overlapping_build_windows: opps.filter((o) => o.timeline_label === "same_window").length,
    plan_changes: changes.length, data_quality_issues: quality.discrepancies.length,
    validation: `Distance math reproduces ${acceptance.matched} of ${acceptance.expected} answer-key distances on the key's own `
      + `coordinates; with GridPulse's own OpenStreetMap locations, ${independent?.found ?? "?"} of ${independent?.expected ?? "?"} answer-key pairs are found.`,
    top_pairs: opps.slice(0, 3).map(pairLine),
    reminder: REVIEW,
  };
}

export function listOpportunities(opps: Opportunity[], args: { tier?: string; limit?: number } = {}) {
  const tier = args.tier?.trim().toUpperCase();
  const limit = Math.min(MAX_LIST, Math.max(1, Math.round(args.limit ?? DEFAULT_LIST)));
  return opps.filter((o) => !tier || o.tier === tier).slice(0, limit).map(pairLine);
}

const changeLine = (c: Change) =>
  `${c.name}: ${c.event.replace(/_/g, " ")} ${c.before ?? "—"} → ${c.after ?? "—"} (${c.evidence.map(cite).join(", ")})`;

export function opportunityFacts(detail: OpportunityDetail, changes: Change[]) {
  const ids = new Set([detail.a.id, detail.b.id]);
  return {
    ...pairLine(detail),
    center_to_center: `${detail.dist_center_mi.toFixed(2)} miles`,
    in_service_gap_days: detail.in_service_gap_days,
    source_facts: detail.evidence.filter((e) => e.type === "fact")
      .map((e) => ({ project: e.project_id, field: e.field, quote: e.quote, source: cite(e as { source_id: string; page: number }) })),
    plan_changes: changes.filter((c) => ids.has(c.primary_id ?? c.project_id)).slice(0, MAX_CHANGES).map(changeLine),
    reminder: REVIEW,
  };
}

export function planChanges(changes: Change[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = changes.filter((c) => {
    const hay = `${c.name} ${c.project_id} ${c.primary_id ?? ""}`.toLowerCase();
    return words.length > 0 && words.every((w) => hay.includes(w));
  });
  return { count: hits.length, changes: hits.slice(0, MAX_CHANGES).map(changeLine) };
}

export function dataQuality(quality: Quality) {
  const byKind: Record<string, number> = {};
  for (const d of quality.discrepancies) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
  return {
    endpoints: quality.coverage.endpoints_by_precision,
    projects_not_located: quality.coverage.projects_unlocated,
    issues_by_kind: byKind,
    coordinate_conflicts: quality.discrepancies.filter((d) => d.kind === "coordinate_conflict").map((d) => d.message),
    answer_key: "Sperry's answer key is a benchmark only; its coordinates are never used as locations. "
      + `Distance math ${quality.acceptance.matched}/${quality.acceptance.expected}; pairs found with our own locations `
      + `${quality.independent?.found ?? "?"}/${quality.independent?.expected ?? "?"}.`,
  };
}
