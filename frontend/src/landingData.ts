// Turns live API data into landing-page content. Pure functions: every number shown on the landing page comes from here
// or straight from the API, never from copy.
import { splitIssue } from "./components/DataQualityView";
import type { Discrepancy, OpportunityDetail } from "./types";

export interface DiscrepancyCard {
  kind: string;
  id: string;
  name: string;
  /** The value GridPulse does not use (shown struck through). */
  a: string;
  /** The value GridPulse uses, or what it did about the disagreement. */
  b: string;
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const SAME_POINT = 1e-6;

export const formatDay = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/** "$17,777,427" -> "$17.78M"; anything that is not a dollar amount is returned unchanged. */
export function compactUsd(printed: string): string {
  const value = Number(printed.replace(/[$,]/g, ""));
  if (!printed.startsWith("$") || !Number.isFinite(value)) return printed;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Math.round(value / 1e3)}K`;
}

const usd = (printed: unknown) => Number(String(printed).replace(/[$,]/g, "")) || 0;
const str = (v: unknown) => String(v ?? "");
const entity = (d: Discrepancy) => splitIssue(d.message, d.endpoint)[0];

type Rule = { kind: string; label: string; pick: (items: Discrepancy[]) => Discrepancy | undefined; card: (d: Discrepancy) => [string, string] };

// One card per rule, in this order. Each rule picks the clearest live example of its kind.
const RULES: Rule[] = [
  { kind: "sources_disagree", label: "SOURCES DISAGREE",
    pick: (items) => items.find((d) => d.values?.table_2),
    card: (d) => [`Table 2: ${formatDay(str(d.values?.table_2))}`, `p.${/p\.(\d+)/.exec(d.message)?.[1] ?? "?"}: ${formatDay(str(d.values?.detail_page))}`] },
  { kind: "coordinate_conflict", label: "COORDINATE CONFLICT",
    pick: (items) => items.toSorted((x, y) => (y.miles_apart ?? 0) - (x.miles_apart ?? 0))[0],
    card: (d) => ["Answer key", `OSM, used · ${(d.miles_apart ?? 0).toFixed(2)} mi apart`] },
  { kind: "cost_table_mismatch", label: "COST TABLE MISMATCH",
    pick: (items) => items.toSorted((x, y) => gap(y) - gap(x))[0],
    card: (d) => [`Columns ${compactUsd(str(d.values?.columns_sum))}`, `Total ${compactUsd(str(d.values?.stated_total))}`] },
  { kind: "sources_disagree", label: "SOURCES DISAGREE",
    pick: (items) => items.find((d) => d.values?.irp),
    card: (d) => [str(d.values?.irp), str(d.values?.sertp)] },
  { kind: "id_reused", label: "ID REUSED",
    pick: (items) => items.find((d) => d.values?.before),
    card: (d) => [`was ${str(d.values?.before)}`, "not linked as a change"] },
  { kind: "date_normalized", label: "DATE NORMALIZED",
    pick: (items) => items.toSorted((x, y) => str(x.values?.printed).length - str(y.values?.printed).length)[0],
    card: (d) => [`printed ${str(d.values?.printed)}`, `used ${formatDay(str(d.values?.used))}`] },
];

function gap(d: Discrepancy): number {
  return Math.abs(usd(d.values?.stated_total) - usd(d.values?.columns_sum));
}

/** Up to six cards, one per rule, taken from the live discrepancy list. Kinds with no entries are skipped. */
export function discrepancyCards(discrepancies: Discrepancy[]): DiscrepancyCard[] {
  return RULES.flatMap((rule) => {
    const d = rule.pick(discrepancies.filter((x) => x.kind === rule.kind));
    if (!d) return [];
    const [a, b] = rule.card(d);
    const name = rule.kind === "coordinate_conflict" ? `${entity(d)} substation` : entity(d);
    return [{ kind: rule.label, id: d.project_id, name, a, b }];
  });
}

/** The located endpoint where a touching pair meets (for "they share the Thurmond endpoint at …"). */
export function sharedEndpoint(detail: OpportunityDetail | null): { name: string; lat: number; lon: number } | null {
  if (!detail?.touching) return null;
  const [lat, lon] = detail.closest_points[0];
  const endpoints = [...detail.project_a.endpoints, ...detail.project_b.endpoints];
  const match = endpoints.find((e) => e.lat != null && e.lon != null && Math.abs(e.lat - lat) < SAME_POINT && Math.abs(e.lon - lon) < SAME_POINT);
  return match ? { name: match.name_raw, lat: match.lat!, lon: match.lon! } : null;
}
