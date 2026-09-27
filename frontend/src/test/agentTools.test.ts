import { dataQuality, listOpportunities, opportunityFacts, planChanges, studySummary, TOOL_NAMES } from "../agentTools";
import type { Change, OpportunityDetail } from "../types";
import { OPPS, QUALITY } from "./fixtures";

const CHANGES: Change[] = [
  { project_id: "desc-2529-6367-d-g", primary_id: "desc-3", utility: "DESC", name: "Jasper – Okatie 230 kV #2: Construct",
    event: "slipped", before: "2025-12-31", after: "2026-05-31",
    evidence: [{ source_id: "desc-2428", page: 23, quote: "12/31/25" }, { source_id: "desc-2529", page: 18, quote: "5/31/2026" }] },
  { project_id: "gpc-20065", primary_id: "gpc-20065", utility: "GPC", name: "SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD",
    event: "sources_disagree", before: "IRP 2027", after: "SERTP 2026: 2028",
    evidence: [{ source_id: "gpc-irp25-v3", page: 183, quote: "6/1/2027" }] },
];

test("the tool names match the agent definition in scripts/voice_agent.py", () => {
  expect(TOOL_NAMES).toEqual(["get_study_summary", "list_opportunities", "get_opportunity", "get_plan_changes",
    "get_data_quality", "show_opportunity"]);
});

test("study summary reports live counts, tiers, validation and the top pairs", () => {
  const s = studySummary(OPPS, CHANGES, QUALITY);
  expect(s.pairs_within_25_mi).toBe(OPPS.length);
  expect(s.pairs_by_tier).toEqual({ T1: 1, T3: 1 });
  expect(s.plan_changes).toBe(2);
  expect(s.validation).toContain("6 of 6");
  expect(s.top_pairs[0]).toMatchObject({ rank: 1, tier: "T1", closest: "touching at a shared facility" });
});

test("list filters by tier and caps the count", () => {
  expect(listOpportunities(OPPS, { tier: "t3" }).map((o) => o.rank)).toEqual([2]);
  expect(listOpportunities(OPPS, { limit: 1 })).toHaveLength(1);
  expect(listOpportunities(OPPS, { limit: 99 })).toHaveLength(OPPS.length);
});

test("opportunity facts carry distances, timing and every source fact with its page", () => {
  const detail = { ...OPPS[1], project_a: {}, project_b: {}, estimator: {}, maps_links: {},
    evidence: [
      { id: "a.in_service_date", type: "fact", label: "FACT · P.23", field: "in_service_date", quote: "12/31/25", page: 23,
        source_id: "desc-2428", project_id: "desc-3" },
      { id: "derived.closest", type: "derived", label: "DERIVED", quote: "Closest-point distance 2.99 mi" },
    ] } as unknown as OpportunityDetail;
  const f = opportunityFacts(detail, CHANGES);
  expect(f).toMatchObject({ rank: 2, tier: "T3", closest: "2.99 miles", center_to_center: "5.65 miles" });
  expect(f.source_facts).toEqual([{ project: "desc-3", field: "in_service_date", quote: "12/31/25", source: "desc-2428 page 23" }]);
  expect(f.plan_changes).toEqual(["Jasper – Okatie 230 kV #2: Construct: slipped 2025-12-31 → 2026-05-31 (desc-2428 page 23, desc-2529 page 18)"]);
  expect(f.reminder).toMatch(/human review/);
});

test("plan changes match by name words or id and cite pages", () => {
  const found = planChanges(CHANGES, "mcintosh");
  expect(found.count).toBe(1);
  expect(found.changes[0]).toContain("gpc-irp25-v3 page 183");
  expect(planChanges(CHANGES, "nothing-here").count).toBe(0);
});

test("data quality summarises provenance, issues and validation", () => {
  const q = dataQuality(QUALITY);
  expect(q.endpoints).toEqual({ osm_feature: 123, unresolved: 204 });
  expect(q.issues_by_kind).toEqual({ coordinate_conflict: 1 });
  expect(q.answer_key).toContain("never used as locations");
});
