import { render, screen } from "@testing-library/react";
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
  expect(await screen.findByText("Coordination opportunities")).toBeInTheDocument();
  expect(await screen.findByText(/SAV: MCINTOSH - PURRYSBURG/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "CLOSEST" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByText("SEED")).toBeInTheDocument();
});
