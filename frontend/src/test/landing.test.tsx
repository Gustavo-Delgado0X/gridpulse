import { render, screen, within } from "@testing-library/react";
import { Landing } from "../components/Landing";
import { isLandingPath } from "../route";
import { OPPS, QUALITY } from "./fixtures";

test("landing route: / without a pair hash; everything else is the workspace", () => {
  expect(isLandingPath("/", "")).toBe(true);
  expect(isLandingPath("/", "#m=closest&d=25")).toBe(true);
  expect(isLandingPath("/", "#pair=desc-1__gpc-1&m=closest")).toBe(false);
  expect(isLandingPath("/app", "")).toBe(false);
});

test("landing shows the headline, live proof numbers and links into the workspace", () => {
  render(<Landing stats={{ projects: 182, pairs: OPPS.length, changes: 322, acceptance: QUALITY.acceptance }}
                  featured={OPPS[1]} quality={QUALITY} />);
  expect(screen.getByRole("heading", { level: 1, name: /GridPulse finds where transmission plans meet/ })).toBeInTheDocument();
  const proof = screen.getByRole("region", { name: "At a glance" });
  expect(within(proof).getByText("182")).toBeInTheDocument();
  expect(within(proof).getByText(String(OPPS.length))).toBeInTheDocument();
  expect(within(proof).getByText("6 / 6")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /Open the workspace/ })[0]).toHaveAttribute("href", "/app");
  expect(screen.getByRole("link", { name: "Open the Savannah / Augusta study" })).toHaveAttribute("href", expect.stringContaining("/app#pair="));
});

test("featured pair card uses the real opportunity values", () => {
  render(<Landing stats={{ projects: 182, pairs: 52, changes: 322, acceptance: QUALITY.acceptance }} featured={OPPS[1]} quality={QUALITY} />);
  const card = screen.getByRole("figure", { name: "Example opportunity" });
  expect(card).toHaveTextContent("2.99 mi");
  expect(card).toHaveTextContent("5.65 mi");
  expect(card).toHaveTextContent("152 d");
});

test("validation table renders every answer-key case", () => {
  render(<Landing stats={{ projects: 182, pairs: 52, changes: 322, acceptance: QUALITY.acceptance }} quality={QUALITY} />);
  const table = screen.getByRole("table", { name: "Sperry answer-key benchmark" });
  expect(within(table).getByText("OVL_1")).toBeInTheDocument();
  expect(within(table).getAllByText("Pass")).toHaveLength(QUALITY.acceptance.details.length);
});
