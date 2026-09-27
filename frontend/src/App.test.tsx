import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { OPPS, QUALITY } from "./test/fixtures";

vi.mock("./components/MapView", () => ({ MapView: () => <div data-testid="map" /> }));

const responses: Record<string, unknown> = {
  "/api/health": { api: "ok", data_mode: "seed", ai: "unavailable", sources_pinned: 7 },
  "/api/projects": [],
  "/api/opportunities": OPPS,
  "/api/quality": QUALITY,
  "/api/changes": [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const path = url.split("?")[0];
    const data = path.startsWith("/api/opportunities/") ? null : responses[path];
    return new Response(JSON.stringify({ data, error: null, meta: {} }), { status: 200 });
  }));
});

test("renders the ranked opportunities from the API", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Savannah / Augusta study" })).toBeInTheDocument();
  expect(await screen.findByText(/SAV: MCINTOSH - PURRYSBURG/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Distance: closest points, 25 miles" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Workspace" })).toHaveTextContent("Opportunities2");
  expect(screen.getByText("Seed dataset")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /Validated 6\/6/ })).toBeInTheDocument();
});

test("clears the detail panel when the threshold leaves no opportunities", async () => {
  const { rerender } = render(<App />);
  expect(await screen.findByText(/SAV: MCINTOSH - PURRYSBURG/)).toBeInTheDocument();
  responses["/api/opportunities"] = [];
  await userEvent.click(screen.getByRole("button", { name: /Distance:/ }));
  fireEvent.change(screen.getByRole("slider"), { target: { value: "5" } });
  rerender(<App />);
  expect(await screen.findByText("No opportunities match")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Selected opportunity" })).not.toBeInTheDocument();
});

test("a share link pasted into the open tab (hash change) opens that pair, method and radius", async () => {
  responses["/api/opportunities"] = OPPS;
  render(<App />);
  expect(await screen.findByText(/SAV: MCINTOSH - PURRYSBURG/)).toBeInTheDocument();
  window.location.hash = `#pair=${OPPS[1].id}&m=center&d=10`;
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(await screen.findByRole("region", { name: "Pair detail" })).toHaveTextContent(`2 / ${OPPS.length}`);
  expect(screen.getByRole("button", { name: "Distance: project centers, 10 miles" })).toBeInTheDocument();
});
