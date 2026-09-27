import type { Opportunity, ProjectRef, Quality } from "../types";

export const ref = (over: Partial<ProjectRef>): ProjectRef => ({
  id: "desc-1", utility: "DESC", name: "Hooks - Thurmond 115kV Tie: Rebuild", source_id: "desc-2428", page: 31,
  in_service_date: "2024-12-31", window_start: "2024-01-01", window_end: "2024-12-31", precision: "sperry_provided",
  answer_key_id: "DESC_2", ...over,
});

export const opp = (over: Partial<Opportunity>): Opportunity => ({
  id: "desc-1__gpc-1", a: ref({}), b: ref({ id: "gpc-1", utility: "GPC", name: "EVANS PRIMARY - THURMOND DAM #5",
    source_id: "gpc-irp25-v3", page: 410, in_service_date: "2033-06-01", answer_key_id: "GPC_1" }),
  method: "closest", tier: "T1", touching: true, dist_closest_mi: 0, dist_center_mi: 4.088, in_sperry_method: true,
  closest_points: [[33.66, -82.19], [33.66, -82.19]], centers: [[33.66, -82.19], [33.6, -82.18]],
  window_overlap_days: 0, in_service_gap_days: 3074, timeline_label: "separate", rank: 1, flags: [],
  precision_a: "sperry_provided", precision_b: "sperry_provided", ...over,
});

export const OPPS: Opportunity[] = [
  opp({}),
  opp({ id: "desc-3__gpc-2", rank: 2, tier: "T3", touching: false, dist_closest_mi: 2.993, dist_center_mi: 5.65,
        timeline_label: "same_window", in_service_gap_days: 152, flags: ["method_disagree"],
        a: ref({ id: "desc-3", name: "Jasper – Okatie 230 kV #2: Construct" }),
        b: ref({ id: "gpc-2", utility: "GPC", name: "SAV: MCINTOSH - PURRYSBURG 230KV REACTORS" }) }),
];

export const QUALITY: Quality = {
  coverage: { projects: 182, projects_located: 101, projects_unlocated: 81,
              endpoints_by_precision: { osm_feature: 114, sperry_provided: 16, unresolved: 197 } },
  acceptance: { passed: true, matched: 6, expected: 6, unexpected: 0, details: [
    { overlap_id: "OVL_1", expected_mi: 4.09, got_mi: 4.09, expected_gap: 3074, got_gap: 3074, passed: true }] },
  discrepancies: [{ kind: "coordinate_conflict", project_id: "gpc-20065", message: "MCINTOSH: OSM and Sperry's answer key differ by 0.41 mi" }],
};
