// Formatting and the client-side mirror of the estimator formula (engine/estimate.py).
import type { Precision, Tier, TimelineLabel } from "./types";

export const TIER_TEXT: Record<Tier, string> = {
  T1: "MUST COORDINATE",
  T2: "SHARE LAND",
  T3: "SHARE LOGISTICS",
  T4: "SHARE CREWS",
};

export const TIMING_TEXT: Record<TimelineLabel, string> = {
  same_window: "SAME BUILD WINDOW",
  within_1y: "WITHIN 1 YEAR",
  separate: "SEPARATE TIMING",
};

export const PRECISION_TEXT: Record<Precision, string> = {
  osm_feature: "OSM",
  sperry_provided: "SPERRY",
  endpoint_proxy: "PROXY",
  regional_approximation: "REGIONAL",
  unresolved: "UNRESOLVED",
};

export const FLAG_TEXT: Record<string, string> = {
  method_disagree: "METHODS DISAGREE",
  low_confidence_location: "LOW-CONFIDENCE LOCATION",
  sources_disagree: "SOURCES DISAGREE",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatUsd(value: number): string {
  return usd.format(Math.round(value));
}

export function formatMiles(value: number, touching = false): string {
  return touching ? "touching" : `${value.toFixed(2)} mi`;
}

export function formatDate(iso: string | null): string {
  return iso ?? "—";
}

const SQFT_PER_ACRE = 43_560;
const FEET_PER_MILE = 5_280;

export interface EstimateValues {
  shared_corridor_mi: number;
  row_width_ft: number;
  usd_per_acre: number;
  mobilization_usd: number;
  avoided_mobilizations: number;
}

export function computeEstimate(v: EstimateValues) {
  const acres = (v.shared_corridor_mi * FEET_PER_MILE * v.row_width_ft) / SQFT_PER_ACRE;
  const land = acres * v.usd_per_acre;
  const mobilization = v.mobilization_usd * v.avoided_mobilizations;
  return { acres, land, mobilization, total: land + mobilization };
}
