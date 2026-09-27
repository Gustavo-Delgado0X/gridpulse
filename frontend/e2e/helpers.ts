// Shared helpers for the control-by-control E2E suites. Expected values come from the live API, never hardcoded,
// so every assertion checks the UI against the data it was built from.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export interface Opp {
  id: string;
  rank: number;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  touching: boolean;
  dist_closest_mi: number;
  window_overlap_days: number | null;
  timeline_label: string;
  flags: string[];
  a: { id: string; name: string };
  b: { id: string; name: string };
}

export interface Change {
  project_id: string;
  primary_id: string | null;
  utility: string;
  name: string;
  event: string;
  before: string | null;
  after: string | null;
}

export const THURMOND = "desc-2428-6810-a__gpc-20793";
export const GOSHEN = "desc-2428-6367-d-g__gpc-20065";

export async function apiData<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`/api${path}`);
  expect(response.ok(), `${path} → ${response.status()}`).toBeTruthy();
  return (await response.json()).data as T;
}

export const opportunities = (request: APIRequestContext, d = 25, method = "closest") =>
  apiData<Opp[]>(request, `/opportunities?d=${d}&method=${method}`);

export const rows = (page: Page) => page.getByRole("listbox", { name: "Opportunities" }).getByRole("option");
export const inspector = (page: Page) => page.getByRole("region", { name: "Selected opportunity" });
export const pairPanel = (page: Page) => page.getByRole("region", { name: "Pair detail" });
export const distanceButton = (page: Page) => page.getByRole("button", { name: /^Distance:/ });

/** Rank numbers of the rows as shown, top to bottom. */
export async function shownRanks(page: Page): Promise<number[]> {
  const texts = await rows(page).locator(".qrow__rank").allTextContents();
  return texts.map((t) => Number(t.replace("#", "")));
}

/** Waits until the queue shows exactly `count` rows, or its empty state when count is 0. */
export async function expectRowCount(page: Page, count: number) {
  if (count === 0) await expect(page.getByText("No opportunities match")).toBeVisible();
  else await expect(rows(page)).toHaveCount(count);
}

export async function mapReady(page: Page) {
  await page.waitForFunction(() => {
    const map = (window as unknown as { __gridpulseMap?: { isStyleLoaded: () => boolean; getSource: (id: string) => unknown } }).__gridpulseMap;
    return Boolean(map && map.getSource("overlaps") && map.isStyleLoaded());
  });
}
