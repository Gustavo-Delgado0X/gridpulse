import { overlapLines, pairBounds, projectLines, projectPoints, touchPoints } from "../mapData";
import type { Project } from "../types";
import { OPPS } from "./fixtures";

const project = (id: string, utility: "DESC" | "GPC", pts: [number, number][]): Project => ({
  id, utility, name: id, description: null, need_text: null, status: null, source_id: "s", page: 1, in_service_date: "2026-01-01",
  window_start: null, window_end: null, window_method: null, voltage_kv: 115, line_miles: null, cost_public: null,
  change_notes: null, evidence: [],
  endpoints: pts.map(([lat, lon], i) => ({ id: `${id}-${i}`, name_raw: `${i}`, lat, lon, precision: "osm_feature",
    method: "", source: null, confirmed_by_pdf_context: true })),
});

test("project lines need two located endpoints; points dedupe per utility", () => {
  const ps = [project("a", "DESC", [[32, -81], [33, -81]]), project("b", "GPC", [[32, -82]])];
  expect(projectLines(ps).features).toHaveLength(1);
  expect(projectPoints(ps).features).toHaveLength(3);
  expect(projectLines(ps).features[0].geometry.coordinates[0]).toEqual([-81, 32]);
});

test("overlap lines interpolate from centers to closest points", () => {
  const start = overlapLines(OPPS, "center", "closest", 0, null).features[0].geometry.coordinates;
  const end = overlapLines(OPPS, "center", "closest", 1, OPPS[0].id).features[0];
  expect(start[1]).toEqual([OPPS[0].centers[1][1], OPPS[0].centers[1][0]]);
  expect(end.geometry.coordinates[1]).toEqual([OPPS[0].closest_points[1][1], OPPS[0].closest_points[1][0]]);
  expect(end.properties?.selected).toBe(true);
});

test("touching pairs get a ring only in closest mode", () => {
  expect(touchPoints(OPPS, "closest").features).toHaveLength(1);
  expect(touchPoints(OPPS, "center").features).toHaveLength(0);
});

test("pair bounds cover both projects", () => {
  const map = new Map([["desc-1", project("desc-1", "DESC", [[33.5, -82.0]])], ["gpc-1", project("gpc-1", "GPC", [[33.7, -82.3]])]]);
  const [[w, s], [e, n]] = pairBounds(OPPS[0], map)!;
  expect(w).toBeLessThanOrEqual(-82.3);
  expect(e).toBeGreaterThanOrEqual(-82.0);
  expect(s).toBeLessThanOrEqual(33.5);
  expect(n).toBeGreaterThanOrEqual(33.7);
});
