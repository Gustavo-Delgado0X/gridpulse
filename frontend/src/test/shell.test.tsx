import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PairPanel } from "../components/PairPanel";
import { Sidebar } from "../components/Sidebar";
import { StudyBar } from "../components/StudyBar";
import { OpportunityTable } from "../components/OpportunityTable";
import { applyFilters, EMPTY_FILTERS } from "../filters";
import { OPPS, QUALITY } from "./fixtures";

function renderSidebar(over: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = { view: "opportunities" as const, onView: vi.fn(), counts: { opportunities: 52, changes: 317, issues: 41 },
    collapsed: false, onCollapse: vi.fn(), query: "", onQuery: vi.fn(), acceptance: QUALITY.acceptance, dataMode: "seed",
    theme: "light" as const, onTheme: vi.fn(), onHelp: vi.fn(), ...over };
  render(<Sidebar {...props} />);
  return props;
}

test("sidebar navigation shows live counts and marks the current view", () => {
  renderSidebar();
  const nav = screen.getByRole("navigation", { name: "Workspace" });
  expect(within(nav).getByRole("button", { name: /Opportunities\s*52/ })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("button", { name: /Plan changes\s*317/ })).toBeInTheDocument();
  expect(within(nav).getByRole("button", { name: /Data quality\s*41/ })).toBeInTheDocument();
});

test("validated badge opens data quality; collapse toggle reports", async () => {
  const props = renderSidebar();
  await userEvent.click(screen.getByRole("button", { name: /Validated 6\/6/ }));
  expect(props.onView).toHaveBeenCalledWith("quality");
  await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(props.onCollapse).toHaveBeenCalledWith(true);
});

test("collapsed sidebar keeps accessible names and Ctrl/Cmd+K expands and focuses search", () => {
  const props = renderSidebar({ collapsed: true });
  expect(screen.getByRole("button", { name: /Plan changes/ })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  expect(props.onCollapse).toHaveBeenCalledWith(false);
});

test("sidebar never shows an invented user identity", () => {
  renderSidebar();
  expect(screen.queryByText("Analyst")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
});

test("study bar distance popover sets method and a 1 mi radius", async () => {
  const onMethod = vi.fn();
  const onDistance = vi.fn();
  render(<StudyBar items={OPPS} filters={EMPTY_FILTERS} method="closest" onMethod={onMethod} distance={25} onDistance={onDistance}
                   onReset={() => {}} onMustCoordinate={() => {}} onOverlap={() => {}} onConflicts={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /Distance: closest points, 25 miles/ }));
  await userEvent.click(screen.getByRole("button", { name: "1 mi" }));
  expect(onDistance).toHaveBeenCalledWith(1);
  await userEvent.click(screen.getByRole("radio", { name: "Project centers" }));
  expect(onMethod).toHaveBeenCalledWith("center");
  expect(screen.getByRole("slider")).toHaveAttribute("min", "1");
});

test("selected queue row offers Open details; Enter opens it", async () => {
  const onOpen = vi.fn();
  function Q() {
    const [f, setF] = useState(EMPTY_FILTERS);
    return <OpportunityTable items={applyFilters(OPPS, f)} total={OPPS.length} filters={f} onFilters={setF} selectedId={OPPS[1].id}
                             onSelect={() => {}} onHover={() => {}} triage={{}} onOpen={onOpen} />;
  }
  render(<Q />);
  await userEvent.click(screen.getByRole("button", { name: "Open details for #2" }));
  expect(onOpen).toHaveBeenCalledWith(OPPS[1].id);
  const rows = within(screen.getByRole("listbox")).getAllByRole("option");
  fireEvent.keyDown(rows[0], { key: "Enter" });
  expect(onOpen).toHaveBeenLastCalledWith(OPPS[0].id);
});

test("pair panel navigates back, previous, next and widens", async () => {
  const props = { items: OPPS, selectedId: OPPS[1].id, onBack: vi.fn(), onSelect: vi.fn(), wide: false, onWide: vi.fn() };
  render(<PairPanel {...props}><p>detail body</p></PairPanel>);
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next pair" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Previous pair" }));
  expect(props.onSelect).toHaveBeenCalledWith(OPPS[0].id);
  await userEvent.click(screen.getByRole("button", { name: "Widen panel" }));
  expect(props.onWide).toHaveBeenCalledWith(true);
  await userEvent.click(screen.getByRole("button", { name: /Back to list/ }));
  expect(props.onBack).toHaveBeenCalled();
  expect(screen.getByText("detail body")).toBeInTheDocument();
});

test("sidebar shows Ask GridPulse only when the voice analyst is available", async () => {
  const onAskAnalyst = vi.fn();
  renderSidebar({ onAskAnalyst });
  await userEvent.click(screen.getByRole("button", { name: "Talk to the GridPulse analyst" }));
  expect(onAskAnalyst).toHaveBeenCalled();
});

test("without the voice analyst there is no Ask button", () => {
  renderSidebar();
  expect(screen.queryByRole("button", { name: "Talk to the GridPulse analyst" })).not.toBeInTheDocument();
});
