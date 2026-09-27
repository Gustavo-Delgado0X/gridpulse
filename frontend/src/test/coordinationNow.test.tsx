import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoordinationNow } from "../components/CoordinationNow";
import type { Change } from "../types";
import { OPPS, ref } from "./fixtures";

const PAIRS = [OPPS[0], { ...OPPS[1], flags: ["sources_disagree"], b: ref({ id: "gpc-2", utility: "GPC", source_id: "gpc-irp25-v3", in_service_date: "2027-06-01" }) }];
const SLIP: Change = { project_id: "desc-2630-x", primary_id: "desc-3", utility: "DESC", name: "x", event: "slipped", before: "2026-05-31",
  after: "2026-12-01", evidence: [{ source_id: "desc-2529", page: 18, quote: "a" }, { source_id: "desc-2630", page: 20, quote: "b" }] };

test("each result shows its plan versions, latest dates and any date conflict, and opens the pair", async () => {
  const onOpen = vi.fn();
  render(<CoordinationNow opportunities={PAIRS} changes={[SLIP]} today="2026-09-27" onOpen={onOpen} />);
  const section = screen.getByRole("region", { name: "Coordination now" });
  expect(section).toHaveTextContent("1 pairs");
  expect(section).toHaveTextContent("DESC 2026–30 · in service Dec 1, 2026 · date changed in a later DESC list");
  expect(section).toHaveTextContent("GPC IRP 2025 · need date Jun 1, 2027");
  expect(section).toHaveTextContent("182 days between latest in-service dates");
  expect(section).toHaveTextContent("Date conflict");
  await userEvent.click(screen.getByRole("button", { name: "Open details for #2" }));
  expect(onOpen).toHaveBeenCalledWith(PAIRS[1].id);
});
