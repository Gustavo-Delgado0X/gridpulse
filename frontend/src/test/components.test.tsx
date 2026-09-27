import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostEstimator } from "../components/CostEstimator";
import { DataQualityView } from "../components/DataQualityView";
import { OpportunityTable } from "../components/OpportunityTable";
import { PrecisionTag } from "../components/PrecisionTag";
import { TierBadge } from "../components/TierBadge";
import { TriageControl } from "../components/TriageControl";
import { UtilityChip } from "../components/UtilityChip";
import { computeEstimate, formatMiles, formatUsd } from "../format";
import { OPPS, QUALITY } from "./fixtures";

test("tier badge names the shared resource, not just a color", () => {
  render(<TierBadge tier="T2" />);
  expect(screen.getByText("T2 · SHARE LAND")).toBeInTheDocument();
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

test("opportunity table: rows, keyboard selection and filter shortcut", async () => {
  const onSelect = vi.fn();
  render(<OpportunityTable items={OPPS} selectedId={null} onSelect={onSelect} triage={{}} />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(3);

  const first = within(table).getAllByRole("row")[1];
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(onSelect).toHaveBeenLastCalledWith("desc-3__gpc-2");

  fireEvent.keyDown(document.body, { key: "/" });
  expect(screen.getByRole("searchbox")).toHaveFocus();
  await userEvent.type(screen.getByRole("searchbox"), "purrysburg");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
});

test("opportunity table sorts by a column header", async () => {
  render(<OpportunityTable items={OPPS} selectedId={null} onSelect={() => {}} triage={{}} />);
  await userEvent.click(screen.getByRole("button", { name: /Center mi/ }));
  await userEvent.click(screen.getByRole("button", { name: /Center mi/ }));
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("PURRYSBURG");
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

test("triage control reports the chosen status", async () => {
  const onChange = vi.fn();
  render(<TriageControl value="new" onChange={onChange} />);
  await userEvent.click(screen.getByRole("radio", { name: "CONTACTED" }));
  expect(onChange).toHaveBeenCalledWith("contacted");
});

test("data quality shows the answer-key check and discrepancies", () => {
  render(<DataQualityView quality={QUALITY} />);
  expect(screen.getByText("ANSWER KEY 6/6 ✓")).toBeInTheDocument();
  expect(screen.getByText(/differ by 0.41 mi/)).toBeInTheDocument();
});
