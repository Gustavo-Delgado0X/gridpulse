// Queue/map filtering, filter chips and headline counts (pure; shared by toolbar, queue, map, inspector).
import type { Opportunity, Tier, Triage } from "./types";

export interface Filters {
  query: string;
  tiers: readonly Tier[]; // empty = all tiers
  sameWindowOnly: boolean;
  flags: readonly string[]; // any of these flags
  triage: readonly Triage[]; // empty = any review status
  projectId: string | null; // pairs involving one project (map click)
}

export const EMPTY_FILTERS: Filters = { query: "", tiers: [], sameWindowOnly: false, flags: [], triage: [], projectId: null };

export const FLAG_FILTER_TEXT: Record<string, string> = {
  sources_disagree: "Source conflict",
  low_confidence_location: "Approximate location",
  method_disagree: "Methods disagree",
};

export function toggleTier(filters: Filters, tier: Tier): Filters {
  const tiers = filters.tiers.includes(tier) ? filters.tiers.filter((t) => t !== tier) : [...filters.tiers, tier];
  return { ...filters, tiers };
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function isFiltered(filters: Filters): boolean {
  return Boolean(filters.query || filters.tiers.length || filters.sameWindowOnly || filters.flags.length ||
    filters.triage.length || filters.projectId);
}

function matchesQuery(o: Opportunity, query: string): boolean {
  if (!query) return true;
  const haystack = `${o.a.name} ${o.b.name} ${o.a.id} ${o.b.id} ${o.tier ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

export function applyFilters(items: Opportunity[], filters: Filters, triage: Record<string, Triage> = {}): Opportunity[] {
  return items.filter((o) =>
    (!filters.tiers.length || (o.tier !== null && filters.tiers.includes(o.tier))) &&
    (!filters.sameWindowOnly || o.timeline_label === "same_window") &&
    (!filters.flags.length || filters.flags.some((f) => o.flags.includes(f))) &&
    (!filters.triage.length || filters.triage.includes(triage[o.id] ?? "new")) &&
    (!filters.projectId || o.a.id === filters.projectId || o.b.id === filters.projectId) &&
    matchesQuery(o, filters.query));
}

export interface Chip {
  key: string;
  label: string;
  remove: (f: Filters) => Filters;
}

export function activeChips(filters: Filters, projectName?: string): Chip[] {
  return [
    ...filters.tiers.map((t) => ({ key: `tier-${t}`, label: `Tier: ${t}`, remove: (f: Filters) => toggleTier(f, t) })),
    ...(filters.sameWindowOnly ? [{ key: "window", label: "Timing: overlap", remove: (f: Filters) => ({ ...f, sameWindowOnly: false }) }] : []),
    ...filters.flags.map((flag) => ({ key: `flag-${flag}`, label: FLAG_FILTER_TEXT[flag] ?? flag,
      remove: (f: Filters) => ({ ...f, flags: f.flags.filter((x) => x !== flag) }) })),
    ...filters.triage.map((t) => ({ key: `triage-${t}`, label: `Status: ${t[0].toUpperCase()}${t.slice(1)}`,
      remove: (f: Filters) => ({ ...f, triage: f.triage.filter((x) => x !== t) }) })),
    ...(filters.projectId ? [{ key: "project", label: `Project: ${projectName ?? filters.projectId}`,
      remove: (f: Filters) => ({ ...f, projectId: null }) }] : []),
  ];
}

export function pairsFor(projectId: string, items: Opportunity[]): Opportunity[] {
  return items.filter((o) => o.a.id === projectId || o.b.id === projectId);
}

export function summarize(items: Opportunity[]) {
  return {
    pairs: items.length,
    mustCoordinate: items.filter((o) => o.tier === "T1").length,
    sameWindow: items.filter((o) => o.timeline_label === "same_window").length,
    sourcesDisagree: items.filter((o) => o.flags.includes("sources_disagree")).length,
  };
}
