import { coordinationNow, latestDates, planLabel } from "../latestPlan";
import type { Change } from "../types";
import { OPPS, ref } from "./fixtures";

const FUTURE_GPC = ref({ id: "gpc-2", utility: "GPC", source_id: "gpc-irp25-v3", in_service_date: "2027-06-01" });
const PAIRS = [OPPS[0], { ...OPPS[1], b: FUTURE_GPC }];

const slip = (primary: string, after: string, from: string, to: string): Change => ({
  project_id: `${to}-x`, primary_id: primary, utility: "DESC", name: "x", event: "slipped", before: "2025-12-31", after,
  evidence: [{ source_id: from, page: 1, quote: "a" }, { source_id: to, page: 2, quote: "b" }],
});

test("latest date per project comes from the newest plan edition that changed it", () => {
  const latest = latestDates([slip("desc-3", "2026-05-31", "desc-2428", "desc-2529"), slip("desc-3", "2026-12-01", "desc-2529", "desc-2630")]);
  expect(latest.get("desc-3")).toEqual({ date: "2026-12-01", source: "desc-2630" });
});

test("plan labels name the edition", () => {
  expect(planLabel("desc-2630")).toBe("DESC 2026–30");
  expect(planLabel("desc-2428")).toBe("DESC 2024–28");
  expect(planLabel("gpc-irp25-v3")).toBe("GPC IRP 2025");
});

test("coordination now keeps pairs whose latest dates are both still ahead and ranks the closest dates first", () => {
  // OPPS[0]: DESC 2024-12-31 (already in service) -> dropped; OPPS[1]: DESC slips to 2026-12-01, GPC 2033-06-01
  const rows = coordinationNow(PAIRS, [slip("desc-3", "2026-12-01", "desc-2529", "desc-2630")], "2026-09-27");
  expect(rows.map((r) => r.opportunity.id)).toEqual([OPPS[1].id]);
  expect(rows[0]).toMatchObject({ a: { date: "2026-12-01", plan: "DESC 2026–30", changed: true },
    b: { date: "2027-06-01", plan: "GPC IRP 2025", changed: false } });
  expect(rows[0].gapDays).toBe(182);
});

test("a pair whose DESC project already finished in the latest plan drops out", () => {
  expect(coordinationNow(PAIRS, [slip("desc-3", "2026-01-15", "desc-2529", "desc-2630")], "2026-09-27")).toEqual([]);
});
