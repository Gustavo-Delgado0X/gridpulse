// Table/map filtering and the headline counts (pure, shared by the strip, table and map).
import type { Opportunity, Tier } from "./types";

export interface Filters {
  query: string;
  tiers: readonly Tier[]; // empty = all tiers
  sameWindowOnly: boolean;
  flag: string | null;
}

export const EMPTY_FILTERS: Filters = { query: "", tiers: [], sameWindowOnly: false, flag: null };

export function toggleTier(filters: Filters, tier: Tier): Filters {
  const tiers = filters.tiers.includes(tier) ? filters.tiers.filter((t) => t !== tier) : [...filters.tiers, tier];
  return { ...filters, tiers };
}

export function isFiltered(filters: Filters): boolean {
  return Boolean(filters.query || filters.tiers.length || filters.sameWindowOnly || filters.flag);
}

function matchesQuery(o: Opportunity, query: string): boolean {
  if (!query) return true;
  const haystack = `${o.a.name} ${o.b.name} ${o.a.id} ${o.b.id} ${o.tier ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

export function applyFilters(items: Opportunity[], filters: Filters): Opportunity[] {
  return items.filter((o) =>
    (!filters.tiers.length || (o.tier !== null && filters.tiers.includes(o.tier))) &&
    (!filters.sameWindowOnly || o.timeline_label === "same_window") &&
    (!filters.flag || o.flags.includes(filters.flag)) &&
    matchesQuery(o, filters.query));
}

export function summarize(items: Opportunity[]) {
  return {
    pairs: items.length,
    mustCoordinate: items.filter((o) => o.tier === "T1").length,
    sameWindow: items.filter((o) => o.timeline_label === "same_window").length,
    sourcesDisagree: items.filter((o) => o.flags.includes("sources_disagree")).length,
  };
}
