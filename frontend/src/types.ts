// Types mirroring the backend contracts (docs/GRIDPULSE_CONTRACTS_DRAFT.md §3).
export type Utility = "DESC" | "GPC" | "other_utility";
export type Tier = "T1" | "T2" | "T3" | "T4";
export type Method = "closest" | "center";
export type TimelineLabel = "same_window" | "within_1y" | "separate";
export type Precision = "osm_feature" | "sperry_provided" | "endpoint_proxy" | "regional_approximation" | "unresolved";
export type Triage = "new" | "reviewed" | "contacted" | "dismissed";
export type LatLon = [number, number];

export interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown>;
}

export interface Endpoint {
  id: string;
  name_raw: string;
  lat: number | null;
  lon: number | null;
  precision: Precision;
  method: string;
  source: string | null;
  confirmed_by_pdf_context: boolean;
  osm_name?: string | null;
}

export interface EvidenceQuote {
  field: string;
  quote: string;
  page: number;
  source_id: string;
}

export interface Project {
  id: string;
  utility: Utility;
  name: string;
  description: string | null;
  need_text: string | null;
  status: string | null;
  source_id: string;
  page: number;
  detail_page?: number | null;
  in_service_date: string;
  window_start: string | null;
  window_end: string | null;
  window_method: string | null;
  voltage_kv: number | null;
  line_miles: number | null;
  endpoints: Endpoint[];
  cost_public: { total_usd: number; by_year: Record<string, number>; previous_usd: number } | null;
  change_notes: { vs_prev_ten_year: string | null; vs_prev_irp: string | null } | null;
  evidence: EvidenceQuote[];
  answer_key_id?: string;
  zone?: string;
  sponsor_raw?: string;
}

export interface ProjectRef {
  id: string;
  utility: Utility;
  name: string;
  source_id: string;
  page: number;
  in_service_date: string;
  window_start: string | null;
  window_end: string | null;
  precision: Precision;
  answer_key_id: string | null;
}

export interface Opportunity {
  id: string;
  a: ProjectRef;
  b: ProjectRef;
  method: Method;
  tier: Tier | null;
  touching: boolean;
  dist_closest_mi: number;
  dist_center_mi: number;
  in_sperry_method: boolean;
  closest_points: [LatLon, LatLon];
  centers: [LatLon, LatLon];
  window_overlap_days: number | null;
  in_service_gap_days: number;
  timeline_label: TimelineLabel;
  rank: number;
  flags: string[];
  precision_a: Precision;
  precision_b: Precision;
}

export interface EvidenceItemData {
  id: string;
  type: "fact" | "derived" | "interpretation";
  label: string;
  quote: string;
  page?: number;
  source_id?: string;
  field?: string;
  project_id?: string;
}

export interface EstimatorInputs {
  shared_corridor_mi: number;
  corridor_source?: string;
  row_width_ft: number;
  usd_per_acre: number;
  mobilization_usd: number;
  avoided_mobilizations: number;
  assumptions: { key: string; text: string }[];
  cost_context: { utility: Utility; total_usd: number | null; note: string | null }[];
}

export interface OpportunityDetail extends Opportunity {
  project_a: Project;
  project_b: Project;
  evidence: EvidenceItemData[];
  estimator: { inputs: EstimatorInputs };
  maps_links: { a: string | null; b: string | null };
}

export interface Discrepancy {
  kind: string;
  project_id: string;
  message: string;
  miles_apart?: number;
  values?: Record<string, unknown>;
  endpoint?: string;
}

export interface Quality {
  coverage: {
    projects: number;
    projects_located: number;
    projects_unlocated: number;
    endpoints_by_precision: Record<string, number>;
  };
  acceptance: {
    passed: boolean;
    matched: number;
    expected: number;
    unexpected: number;
    details: { overlap_id: string; expected_mi: number; got_mi: number; expected_gap: number; got_gap: number; passed: boolean }[];
  };
  /** The answer-key pairs as GridPulse finds them with its own locations (OSM + reviewed overrides, no key coordinates). */
  independent: {
    found: number;
    expected: number;
    details: {
      overlap_id: string; expected_mi: number; got_center_mi: number | null; tier: Tier | null; touching: boolean;
      got_closest_mi: number | null; expected_gap: number; got_gap: number | null; found: boolean;
    }[];
  };
  discrepancies: Discrepancy[];
  built_at?: string;
}

export interface Change {
  project_id: string;
  /** Id of the same project in the list the opportunities are ranked on (DESC 2024-28 / GPC IRP), if any. */
  primary_id?: string | null;
  utility: Utility;
  name: string;
  event: string;
  before: string | null;
  after: string | null;
  evidence: { source_id: string; page: number; quote: string }[];
}

export interface Health {
  api: string;
  data_mode: "seed" | "db";
  ai: "available" | "unavailable";
  /** ElevenLabs voice briefing: available only when the server has an API key. */
  voice?: "available" | "unavailable";
  /** ElevenLabs voice agent: available when the server has a key and an agent id. */
  agent?: "available" | "unavailable";
  sources_pinned: number;
}
