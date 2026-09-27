import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CostEstimator } from "../components/CostEstimator";
import { DataQualityView } from "../components/DataQualityView";
import { OpportunitiesToolbar } from "../components/OpportunitiesToolbar";
import { OpportunityTable, tierLine } from "../components/OpportunityTable";
import { PrecisionTag } from "../components/PrecisionTag";
import { TierBadge } from "../components/TierBadge";
import { TriageControl } from "../components/TriageControl";
import { UtilityChip } from "../components/UtilityChip";
import { applyFilters, EMPTY_FILTERS } from "../filters";
import { computeEstimate, formatMiles, formatUsd } from "../format";
import { OPPS, QUALITY } from "./fixtures";

test("tier badge names the shared resource, not just a color", () => {
  render(<TierBadge tier="T2" />);
  expect(screen.getByText("T2 · SHARE LAND")).toBeInTheDocument();
});

test("queue tier line reads as sentence case", () => {
  expect(tierLine({ tier: "T3" })).toBe("< 5 mi · Share logistics");
  expect(tierLine({ tier: null })).toBe("Beyond 25 mi");
});

test("utility chip always pairs a shape with the label", () => {
  const { container } = render(<><UtilityChip utility="DESC" /><UtilityChip utility="GPC" /></>);
  expect(screen.getByText("DESC")).toBeInTheDocument();
  expect(container.querySelector("[data-shape='circle']")).not.toBeNull();
  expect(container.querySelector("[data-shape='square']")).not.toBeNull();
});

test("precision tag uses the contract labels", () => {
  render(<PrecisionTag precision="regional_approximation" />);
  expect(screen.getByText("REGIONAL")).toBeInTheDocument();
});

test("formatters", () => {
  expect(formatMiles(0, true)).toBe("touching");
  expect(formatMiles(2.9934)).toBe("2.99 mi");
  expect(formatUsd(1234567)).toBe("$1,234,567");
});

test("estimate matches the backend formula", () => {
  const r = computeEstimate({ shared_corridor_mi: 2, row_width_ft: 100, usd_per_acre: 5000, mobilization_usd: 250000,
                              avoided_mobilizations: 2 });
  expect(r.acres).toBeCloseTo((2 * 5280 * 100) / 43560);
  expect(r.total).toBeCloseTo(r.acres * 5000 + 500000);
});

function Queue(props: Partial<Parameters<typeof OpportunityTable>[0]>) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  return <OpportunityTable items={applyFilters(OPPS, filters)} total={OPPS.length} filters={filters} onFilters={setFilters}
                           selectedId={OPPS[0].id} onSelect={() => {}} onHover={() => {}} triage={{}} {...props} />;
}

test("queue: rows, keyboard selection and filter shortcut", async () => {
  const onSelect = vi.fn();
  render(<Queue onSelect={onSelect} />);
  const list = screen.getByRole("listbox", { name: "Opportunities" });
  const rows = within(list).getAllByRole("option");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveAttribute("aria-selected", "true");

  rows[0].focus();
  fireEvent.keyDown(rows[0], { key: "ArrowDown" });
  expect(onSelect).toHaveBeenLastCalledWith("desc-3__gpc-2");

  fireEvent.keyDown(document.body, { key: "/" });
  expect(screen.getByRole("searchbox")).toHaveFocus();
  await userEvent.type(screen.getByRole("searchbox"), "purrysburg");
  expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
});

test("filter popover narrows the queue, chips remove filters, empty state explains itself", async () => {
  render(<Queue />);
  await userEvent.click(screen.getByRole("button", { name: "Filter opportunities" }));
  await userEvent.click(screen.getByLabelText("T2 · < 1 mi"));
  expect(screen.getByText("No opportunities match")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove filter Tier: T2" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);
});

test("hovering a row reports it for map highlighting", async () => {
  const onHover = vi.fn();
  render(<Queue onHover={onHover} />);
  await userEvent.hover(within(screen.getByRole("listbox")).getAllByRole("option")[1]);
  expect(onHover).toHaveBeenLastCalledWith("desc-3__gpc-2");
});

test("row meta shows closest distance, overlap and gap; conflicts are called out", () => {
  render(<Queue />);
  const second = within(screen.getByRole("listbox")).getAllByRole("option")[1];
  expect(second).toHaveTextContent("2.99 mi closest");
  expect(second).toHaveTextContent("152 d in-service gap");
});

test("toolbar metrics are filter buttons and the method control is a roving radio group", async () => {
  const onMust = vi.fn();
  const onMethod = vi.fn();
  render(<OpportunitiesToolbar items={OPPS} filters={EMPTY_FILTERS} method="closest" onMethod={onMethod} distance={25} onDistance={() => {}}
                               onReset={() => {}} onMustCoordinate={onMust} onOverlap={() => {}} onConflicts={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /1\s*must coordinate/ }));
  expect(onMust).toHaveBeenCalled();
  const closest = screen.getByRole("radio", { name: "Closest points" });
  expect(closest).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("radio", { name: "Project centers" })).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(closest, { key: "ArrowRight" });
  expect(onMethod).toHaveBeenLastCalledWith("center");
});

test("cost estimator recomputes when an assumption is edited", async () => {
  render(<CostEstimator inputs={{ shared_corridor_mi: 0, row_width_ft: 100, usd_per_acre: 5000, mobilization_usd: 250000,
    avoided_mobilizations: 1, assumptions: [{ key: "row_width_ft", text: "ROW width: team assumption" }],
    cost_context: [{ utility: "DESC", total_usd: 11116933, note: null }, { utility: "GPC", total_usd: null, note: "redacted in public filing" }] }} />);
  expect(screen.getByText("ROUGH ESTIMATE")).toBeInTheDocument();
  expect(screen.getByTestId("estimate-total")).toHaveTextContent("$250,000");
  const miles = screen.getByLabelText(/Shared corridor/);
  await userEvent.clear(miles);
  await userEvent.type(miles, "1");
  expect(screen.getByTestId("estimate-total")).toHaveTextContent("$310,606");
  expect(screen.getByText(/redacted in public filing/)).toBeInTheDocument();
});

test("triage menu reports the chosen status", async () => {
  const onChange = vi.fn();
  render(<TriageControl value="new" onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Review status: New" }));
  await userEvent.click(screen.getByRole("radio", { name: "Contacted" }));
  expect(onChange).toHaveBeenCalledWith("contacted");
});

test("data quality shows the validation benchmark, provenance and issues", async () => {
  render(<DataQualityView quality={QUALITY} opportunities={OPPS} />);
  expect(screen.getByRole("heading", { level: 1, name: "Data quality" })).toBeInTheDocument();
  expect(screen.getByText("Validation passed")).toBeInTheDocument();
  expect(screen.getByText("Sperry-confirmed")).toBeInTheDocument();
  expect(screen.getByText(/differ by 0.41 mi/)).toBeInTheDocument();
  expect(screen.getByText("Status · proposed")).toBeInTheDocument();
});

test("issue messages split into entity and finding even when names contain colons", async () => {
  const { splitIssue } = await import("../components/DataQualityView");
  expect(splitIssue("SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD: IRP 2027 vs SERTP 2026: 2028"))
    .toEqual(["SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD", "IRP 2027 vs SERTP 2026: 2028"]);
  expect(splitIssue("MCINTOSH: OSM and Sperry's answer key differ by 0.41 mi", "MCINTOSH"))
    .toEqual(["MCINTOSH", "OSM and Sperry's answer key differ by 0.41 mi"]);
});

test("data quality lists parser anomalies with their own labels", async () => {
  const q = { ...QUALITY, discrepancies: [...QUALITY.discrepancies,
    { kind: "cost_table_mismatch", project_id: "desc-2428-x", message: "Riverport Tap: cost columns sum to $1 but the Total column says $2 (desc-2428 p.22); GridPulse shows the Total",
      values: { columns_sum: "$1", stated_total: "$2" } }] };
  render(<DataQualityView quality={q} opportunities={OPPS} />);
  expect(screen.getByText("◆ Cost table mismatch")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cost tables" })).toBeInTheDocument();
  expect(screen.getAllByText("No ranked pair").length).toBeGreaterThan(0);
});

test("plan changes link later-list events to the ranked opportunity through primary_id", async () => {
  const { PlanChangesView } = await import("../components/PlanChangesView");
  const onOpen = vi.fn();
  render(<PlanChangesView opportunities={OPPS} onOpenOpportunity={onOpen} changes={[{ project_id: "desc-2529-z", primary_id: "desc-3",
    utility: "DESC", name: "Jasper – Okatie 230 kV #2: Construct", event: "slipped", before: "2025-12-31", after: "2026-05-31",
    evidence: [{ source_id: "desc-2428", page: 23, quote: "12/31/25" }, { source_id: "desc-2529", page: 18, quote: "5/31/2026" }] }]} />);
  await userEvent.click(screen.getByRole("button", { name: "1 opportunity →" }));
  expect(onOpen).toHaveBeenCalledWith("desc-3__gpc-2");
});
