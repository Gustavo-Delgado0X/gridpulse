import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Landing, type LandingStats } from "../components/Landing";
import { isLandingPath } from "../route";
import { OPPS, QUALITY } from "./fixtures";

const STATS: LandingStats = { projects: 182, pairs: OPPS.length, changes: 317, acceptance: QUALITY.acceptance, independent: QUALITY.independent };
const SHARED = { name: "Thurmond", lat: 33.660127, lon: -82.195931 };
const FACT = { name: "Jasper – Okatie 230 kV #2: Construct", printed: "12/31/25", source_id: "desc-2428", page: 23 };
const full = () => render(<Landing stats={STATS} featured={OPPS[1]} finding={OPPS[0]} shared={SHARED} quality={QUALITY} sourceFact={FACT} />);

test("landing route: / without a pair hash; everything else is the workspace", () => {
  expect(isLandingPath("/", "")).toBe(true);
  expect(isLandingPath("/", "#m=closest&d=25")).toBe(true);
  expect(isLandingPath("/", "#pair=desc-1__gpc-1&m=closest")).toBe(false);
  expect(isLandingPath("/app", "")).toBe(false);
});

test("hero shows the live top-ranked finding: center distance, closest points and the shared endpoint", () => {
  full();
  expect(screen.getByRole("heading", { level: 1, name: "Where two utilities' plans meet." })).toBeInTheDocument();
  const finding = screen.getByRole("figure", { name: "Top-ranked finding" });
  expect(finding).toHaveTextContent("RANK #01");
  expect(finding).toHaveTextContent("T1 · TOUCHING");
  expect(finding).toHaveTextContent("4.09 mi");
  expect(finding).toHaveTextContent("0.00 mi");
  expect(finding).toHaveTextContent("They share the Thurmond endpoint at 33.6601, -82.1959");
  expect(within(finding).getByRole("link", { name: "Open this pair →" })).toHaveAttribute("href", `/app#pair=${OPPS[0].id}&m=closest&d=25`);
  expect(screen.getByRole("link", { name: /Explore the 182 projects/ })).toHaveAttribute("href", "/app");
});

test("proof strip and discrepancy band come from the live API numbers", () => {
  full();
  const proof = screen.getByRole("region", { name: "At a glance" });
  for (const n of ["182", String(OPPS.length), "317", String(QUALITY.coverage.endpoints_by_precision.unresolved)]) {
    expect(within(proof).getByText(n)).toBeInTheDocument();
  }
  const band = screen.getByRole("region", { name: "Discrepancies" });
  expect(band).toHaveTextContent(`${QUALITY.discrepancies.length} places the sources disagree.`);
  expect(band).toHaveTextContent("MCINTOSH substation");
  expect(band).toHaveTextContent("OSM, used");
});

test("product tabs switch the screenshot and caption", async () => {
  full();
  const product = screen.getByRole("region", { name: "Product" });
  expect(within(product).getByRole("img")).toHaveAttribute("src", "/landing/opportunities.jpg");
  await userEvent.click(within(product).getByRole("tab", { name: /Plan changes/ }));
  expect(within(product).getByRole("tab", { name: /Plan changes/ })).toHaveAttribute("aria-selected", "true");
  expect(within(product).getByRole("img")).toHaveAttribute("src", "/landing/plan-changes.jpg");
  expect(product).toHaveTextContent("317 changes between plan editions");
  await userEvent.click(within(product).getByRole("tab", { name: /Data quality/ }));
  expect(within(product).getByRole("img")).toHaveAttribute("src", "/landing/data-quality.jpg");
});

test("evidence cards quote the source fact and derive from the featured pair", () => {
  const featured = { ...OPPS[1], window_overlap_days: 213,
    a: { ...OPPS[1].a, window_start: "2024-01-01", window_end: "2025-12-31" },
    b: { ...OPPS[1].b, window_start: "2025-06-01", window_end: "2027-06-01" } };
  render(<Landing stats={STATS} featured={featured} quality={QUALITY} sourceFact={FACT} />);
  expect(screen.getByText(/planned to enter service 12\/31\/25/)).toBeInTheDocument();
  expect(screen.getByText(/desc-2428 · p\.23/)).toBeInTheDocument();
  expect(screen.getByText(/closest point is 2\.99 mi from .*overlap by 213 days \(Jun 2025 → Dec 2025\)/)).toBeInTheDocument();
  expect(screen.getByText(/Tier T3: Share logistics/)).toBeInTheDocument();
});

test("validation shows pairs found with our own locations, and the distance math separately", () => {
  full();
  const table = screen.getByRole("table", { name: "Answer-key pairs found with GridPulse locations" });
  expect(within(table).getAllByText("✓ Found")).toHaveLength(QUALITY.independent.details.length);
  expect(within(table).getByText("20.46")).toBeInTheDocument();
  expect(screen.getByText(`${QUALITY.independent.found}/${QUALITY.independent.expected}`)).toBeInTheDocument();
  expect(screen.getByText(/distance math reproduces 6 of 6 distances/)).toBeInTheDocument();
});

test("links go to the workspace and the source", () => {
  full();
  for (const link of screen.getAllByRole("link", { name: /Open the study/ })) expect(link).toHaveAttribute("href", "/app");
  expect(screen.getByRole("link", { name: "Read the source" })).toHaveAttribute("href", "https://github.com/Gustavo-Delgado0X/gridpulse");
  expect(screen.getByRole("link", { name: "How we cite" })).toHaveAttribute("href", "#evidence");
});

test("never shows the prototype's stale numbers", () => {
  full();
  for (const stale of ["3.40", "322", "199 endpoints", "80 of 182", "Sperry-confirmed", "Analyst"]) {
    expect(document.body).not.toHaveTextContent(stale);
  }
});

test("placeholders, never invented numbers, before data arrives", () => {
  render(<Landing stats={{ projects: null, pairs: null, changes: null, acceptance: null, independent: null }} />);
  const proof = screen.getByRole("region", { name: "At a glance" });
  expect(within(proof).getAllByText("—")).toHaveLength(4);
  expect(screen.getByRole("figure", { name: "Top-ranked finding" })).not.toHaveTextContent(/\d mi/);
});
