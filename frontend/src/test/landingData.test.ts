import { compactUsd, discrepancyCards, sharedEndpoint } from "../landingData";
import type { Discrepancy, OpportunityDetail } from "../types";

const HYUNDAI: Discrepancy = { kind: "sources_disagree", project_id: "gpc-19523", values: { table_2: "2025-01-01", detail_page: "2025-04-25" },
  message: "SAV: CC - HYUNDAI MOTORS SAVANNAH AKA. PROJECT EA: need date differs between Table 2 and detail page p.231" };
const MCINTOSH: Discrepancy = { kind: "coordinate_conflict", project_id: "gpc-20065", endpoint: "MCINTOSH", miles_apart: 0.408,
  values: { osm: [32.35, -81.17], answer_key: [32.35, -81.18] },
  message: "MCINTOSH: OSM and Sperry's answer key differ by 0.41 mi; GridPulse uses OpenStreetMap" };
const JASPER: Discrepancy = { ...MCINTOSH, project_id: "desc-2428-6367-d-g", endpoint: "Jasper", miles_apart: 0.112,
  message: "Jasper: OSM and Sperry's answer key differ by 0.11 mi; GridPulse uses OpenStreetMap" };
const RIVERPORT: Discrepancy = { kind: "cost_table_mismatch", project_id: "desc-2428-6367-a-c-h",
  values: { columns_sum: "$17,777,427", stated_total: "$34,877,427" },
  message: "Riverport Tap: Construct Tap: cost columns sum to $17,777,427 but the Total column says $34,877,427 (desc-2428 p.22); GridPulse shows the Total" };
const OKATIE_COST: Discrepancy = { ...RIVERPORT, project_id: "desc-2428-139-m-n", values: { columns_sum: "$10,529,933", stated_total: "$11,116,933" },
  message: "Okatie 230-115kV Substation: cost columns sum to $10,529,933 but the Total column says $11,116,933 (desc-2428 p.3); GridPulse shows the Total" };
const KRAFT: Discrepancy = { kind: "sources_disagree", project_id: "gpc-20785", values: { irp: "IRP 2027", sertp: "SERTP 2026: 2031" },
  message: "SAV: GOSHEN (SAV) - KRAFT 115KV LINE REBUILD: IRP 2027 vs SERTP 2026: 2031" };
const REUSED_NO_VALUES: Discrepancy = { kind: "id_reused", project_id: "desc-2630-6809-m-p48", values: {},
  message: "Modoc – McCormick 115/46 kV Rebuild: Project ID 6809 M also used on p.19 within desc-2630" };
const REUSED: Discrepancy = { kind: "id_reused", project_id: "desc-2529-6367-a-c-h",
  values: { before: "Riverport Tap: Construct Tap", after: "Sherwood Tap: Construct Tap" },
  message: "Sherwood Tap: Construct Tap: Project ID reused from a different project ('Riverport Tap: Construct Tap'); not linked as a change" };
const PHASED: Discrepancy = { kind: "date_normalized", project_id: "desc-2428-6859",
  values: { printed: "10/1/2025 (phase 1) and 10/1/2026 (phase 2)", used: "2026-10-01" },
  message: "Dawson 230kV Sub and Fold-in: Construct and Rebuild: in-service date phased: 10/1/2025 (phase 1) and 10/1/2026 (phase 2); final phase used (desc-2428 p.34)" };
const IMPOSSIBLE: Discrepancy = { kind: "date_normalized", project_id: "desc-2630-6810-h", values: { printed: "04/31/26", used: "2026-04-30" },
  message: "Summerville 115 kV Loop: Rebuild: in-service date 04/31/26 does not exist; used 2026-04-30 (desc-2630 p.40)" };

const ALL = [HYUNDAI, JASPER, MCINTOSH, OKATIE_COST, RIVERPORT, KRAFT, REUSED_NO_VALUES, REUSED, PHASED, IMPOSSIBLE];

test("compactUsd shortens printed dollar amounts", () => {
  expect(compactUsd("$17,777,427")).toBe("$17.78M");
  expect(compactUsd("$950,000")).toBe("$950K");
  expect(compactUsd("not a number")).toBe("not a number");
});

test("discrepancy cards take one of each kind from the live data, most telling first", () => {
  const cards = discrepancyCards(ALL);

  expect(cards.map((c) => c.kind)).toEqual(["SOURCES DISAGREE", "COORDINATE CONFLICT", "COST TABLE MISMATCH", "SOURCES DISAGREE",
    "ID REUSED", "DATE NORMALIZED"]);
  expect(cards[0]).toEqual({ kind: "SOURCES DISAGREE", id: "gpc-19523", name: "SAV: CC - HYUNDAI MOTORS SAVANNAH AKA. PROJECT EA",
    a: "Table 2: Jan 1, 2025", b: "p.231: Apr 25, 2025" });
  expect(cards[1]).toMatchObject({ id: "gpc-20065", name: "MCINTOSH substation", a: "Answer key", b: "OSM, used · 0.41 mi apart" });
  expect(cards[2]).toMatchObject({ id: "desc-2428-6367-a-c-h", a: "Columns $17.78M", b: "Total $34.88M" }); // largest gap
  expect(cards[3]).toMatchObject({ id: "gpc-20785", a: "IRP 2027", b: "SERTP 2026: 2031" });
  expect(cards[4]).toMatchObject({ id: "desc-2529-6367-a-c-h", a: "was Riverport Tap: Construct Tap", b: "not linked as a change" });
  expect(cards[5]).toMatchObject({ id: "desc-2630-6810-h", name: "Summerville 115 kV Loop: Rebuild", a: "printed 04/31/26", b: "used Apr 30, 2026" });
});

test("discrepancy cards skip kinds that have no entries", () => {
  expect(discrepancyCards([HYUNDAI]).map((c) => c.id)).toEqual(["gpc-19523"]);
  expect(discrepancyCards([])).toEqual([]);
});

test("sharedEndpoint names the facility where a touching pair meets", () => {
  const thurmond = { name_raw: "Thurmond", lat: 33.660127, lon: -82.195931 };
  const detail = {
    touching: true, closest_points: [[33.660127, -82.195931], [33.660127, -82.195931]],
    project_a: { endpoints: [{ name_raw: "Hooks", lat: null, lon: null }, thurmond] },
    project_b: { endpoints: [{ name_raw: "EVANS PRIMARY", lat: 33.54, lon: -82.16 }] },
  } as unknown as OpportunityDetail;

  expect(sharedEndpoint(detail)).toEqual({ name: "Thurmond", lat: 33.660127, lon: -82.195931 });
  expect(sharedEndpoint({ ...detail, touching: false })).toBeNull();
  expect(sharedEndpoint(null)).toBeNull();
});
