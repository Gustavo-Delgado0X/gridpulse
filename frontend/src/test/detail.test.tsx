import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailPanel } from "../components/DetailPanel";
import type { OpportunityDetail, Project } from "../types";
import { OPPS } from "./fixtures";

const project = (id: string, utility: "DESC" | "GPC"): Project => ({
  id, utility, name: `${utility} project`, description: null, need_text: null, status: null, source_id: "s", page: 3,
  in_service_date: "2026-01-01", window_start: null, window_end: null, window_method: null, voltage_kv: 115, line_miles: null,
  endpoints: [], cost_public: null, change_notes: null, evidence: [],
});

const DETAIL: OpportunityDetail = {
  ...OPPS[0], project_a: project("desc-1", "DESC"), project_b: project("gpc-1", "GPC"),
  evidence: [{ id: "a.name", type: "fact", label: "FACT · P.31", quote: "Hooks - Thurmond", page: 31, source_id: "desc-2428", field: "name" },
             { id: "interpretation.template", type: "interpretation", label: "TEMPLATE", quote: "They share a facility." }],
  estimator: { inputs: { shared_corridor_mi: 0, row_width_ft: 100, usd_per_acre: 5000, mobilization_usd: 250000,
    avoided_mobilizations: 1, assumptions: [], cost_context: [] } },
  maps_links: { a: null, b: null },
};

test("detail panel is organised in tabs", async () => {
  render(<DetailPanel detail={DETAIL} triage="new" onTriage={() => {}} briefUrl={(q) => `/brief?${q}`} />);
  expect(screen.getByRole("tab", { name: "OVERVIEW" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("tab", { name: "EVIDENCE" }));
  expect(screen.getByText("Hooks - Thurmond")).toBeInTheDocument();
});

test("brief export carries the edited estimate", async () => {
  render(<DetailPanel detail={DETAIL} triage="new" onTriage={() => {}} briefUrl={(q) => `/brief?${q}`} />);
  await userEvent.click(screen.getByRole("tab", { name: "ESTIMATE" }));
  const miles = screen.getByLabelText(/Shared corridor/);
  await userEvent.clear(miles);
  await userEvent.type(miles, "3");
  expect(screen.getByRole("link", { name: "Export brief" })).toHaveAttribute("href", expect.stringContaining("shared_corridor_mi=3"));
});
