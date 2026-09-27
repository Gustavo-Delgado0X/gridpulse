import { applyFilters, EMPTY_FILTERS, summarize, toggleTier } from "../filters";
import { yearLabels } from "../components/TimelineStrip";
import { parseHash, toHash } from "../urlState";
import { OPPS, opp } from "./fixtures";

const ITEMS = [
  ...OPPS,
  opp({ id: "desc-5__gpc-9", rank: 3, tier: "T4", touching: false, dist_closest_mi: 12, timeline_label: "same_window",
        flags: ["sources_disagree"] }),
];

test("summarize counts the headline numbers", () => {
  expect(summarize(ITEMS)).toEqual({ pairs: 3, mustCoordinate: 1, sameWindow: 2, sourcesDisagree: 1 });
});

test("tier chips narrow the list and toggle off again", () => {
  const t4 = toggleTier(EMPTY_FILTERS, "T4");
  expect(applyFilters(ITEMS, t4).map((o) => o.id)).toEqual(["desc-5__gpc-9"]);
  expect(applyFilters(ITEMS, toggleTier(t4, "T4"))).toHaveLength(3);
});

test("same-window and flag filters combine with the text query", () => {
  const f = { ...EMPTY_FILTERS, sameWindowOnly: true, query: "purrysburg" };
  expect(applyFilters(ITEMS, f).map((o) => o.id)).toEqual(["desc-3__gpc-2"]);
  expect(applyFilters(ITEMS, { ...EMPTY_FILTERS, flag: "sources_disagree" }).map((o) => o.id)).toEqual(["desc-5__gpc-9"]);
});

test("deep-link hash round-trips and ignores junk", () => {
  const hash = toHash({ pair: "desc-2428-6810-a__gpc-20793", method: "center", d: 30 });
  expect(parseHash(hash)).toEqual({ pair: "desc-2428-6810-a__gpc-20793", method: "center", d: 30 });
  expect(parseHash("#m=bogus&d=999&pair=")).toEqual({});
});

test("timeline labels thin out on long spans", () => {
  expect(yearLabels(2024, 2027)).toEqual([2024, 2025, 2026, 2027]);
  expect(yearLabels(2023, 2034)).toEqual([2024, 2026, 2028, 2030, 2032, 2034]);
});
