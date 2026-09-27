// Every map control (zoom, fit, hide unrelated, layers, legend, clicks on overlaps and projects), every control in
// the Plan changes and Data quality views, and the mobile pane switch.
import { expect, test, type Page } from "@playwright/test";
import { apiData, opportunities, pairPanel, rows, type Change, mapReady } from "./helpers";

test.use({ reducedMotion: "reduce" }); // camera moves finish instantly, so zoom assertions are deterministic

type MapHandle = {
  getZoom: () => number;
  getLayoutProperty: (layer: string, prop: string) => unknown;
  queryRenderedFeatures: (geometry?: unknown, options?: { layers: string[] }) => { properties: Record<string, unknown> }[];
  getCanvas: () => HTMLCanvasElement;
};

const zoomLevel = (page: Page) => page.evaluate(() => (window as unknown as { __gridpulseMap: MapHandle }).__gridpulseMap.getZoom());

/** A page pixel where `layer` renders a feature, the canvas is on top, and none of `avoid` renders anything. */
async function featurePixel(page: Page, layer: string, avoid: string[] = []) {
  return page.evaluate(({ layer, avoid }) => {
    const map = (window as unknown as { __gridpulseMap: MapHandle }).__gridpulseMap;
    const canvas = map.getCanvas();
    const box = canvas.getBoundingClientRect();
    for (let y = 8; y < box.height - 8; y += 5) {
      for (let x = 8; x < box.width - 8; x += 5) {
        const hit = map.queryRenderedFeatures([x, y], { layers: [layer] });
        if (!hit.length || document.elementFromPoint(box.left + x, box.top + y) !== canvas) continue;
        if (avoid.length && map.queryRenderedFeatures([x, y], { layers: avoid }).length) continue;
        const props = hit[0].properties;
        return { x: box.left + x, y: box.top + y, id: String(props.project ?? props.id) };
      }
    }
    return null;
  }, { layer, avoid });
}

test.describe("map", () => {
  test("zoom in, zoom out and Fit move the camera", async ({ page }) => {
    await page.goto("/app");
    await mapReady(page);
    const fit = await zoomLevel(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => zoomLevel(page)).toBeCloseTo(fit + 1, 1);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect.poll(() => zoomLevel(page)).toBeCloseTo(fit, 1);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Fit all pairs" }).click();
    await expect.poll(() => zoomLevel(page)).toBeCloseTo(fit, 1);
  });

  test("Hide unrelated removes the other pairs; Show all brings them back", async ({ page }) => {
    await page.goto("/app");
    await mapReady(page);
    const overlapCount = () => page.evaluate(() =>
      (window as unknown as { __gridpulseMap: MapHandle }).__gridpulseMap.queryRenderedFeatures(undefined, { layers: ["ovl-hit"] }).length);
    await expect.poll(overlapCount).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Hide unrelated" }).click();
    await expect(page.getByRole("button", { name: "Show all" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(overlapCount).toBe(0);
    await page.getByRole("button", { name: "Show all" }).click();
    await expect.poll(overlapCount).toBeGreaterThan(0);
  });

  test("Layers: satellite imagery and place labels toggle", async ({ page }) => {
    await page.goto("/app");
    await mapReady(page);
    const imagery = () => page.evaluate(() =>
      (window as unknown as { __gridpulseMap: MapHandle }).__gridpulseMap.getLayoutProperty("imagery", "visibility"));
    await page.getByRole("button", { name: "Map layers" }).click();
    await page.getByLabel("Satellite imagery (USGS)").check();
    await expect.poll(imagery).toBe("visible");
    await expect(page.getByText(/USGS imagery/)).toBeVisible();
    await page.getByLabel("Satellite imagery (USGS)").uncheck();
    await expect.poll(imagery).toBe("none");
    await expect(page.locator(".map-place").first()).toBeVisible();
    await page.getByLabel("Place labels").uncheck();
    await expect(page.locator(".map-place").first()).toBeHidden();
    await page.getByLabel("Place labels").check();
    await expect(page.locator(".map-place").first()).toBeVisible();
  });

  test("Legend collapses and expands", async ({ page }) => {
    await page.goto("/app");
    const toggle = page.getByRole("button", { name: /^Legend/ });
    const legend = page.getByRole("complementary", { name: "Map legend" });
    await expect(legend).toContainText("Selected pair");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(legend).not.toContainText("Selected pair");
    await toggle.click();
    await expect(legend).toContainText("Selected pair");
  });

  test("clicking an overlap line opens that pair", async ({ page, request }) => {
    const opps = await opportunities(request);
    await page.goto("/app");
    await mapReady(page);
    const target = await featurePixel(page, "ovl-hit", ["desc-points", "gpc-points"]);
    expect(target, "an overlap line is visible on the map").not.toBeNull();
    await page.mouse.click(target!.x, target!.y);
    const pair = opps.find((o) => o.id === target!.id)!;
    await expect(pairPanel(page)).toContainText(pair.b.name);
    await expect(page).toHaveURL(new RegExp(`pair=${pair.id}`));
  });

  test("clicking a project filters the queue to its pairs, with a removable chip", async ({ page, request }) => {
    const opps = await opportunities(request);
    await page.goto("/app");
    await mapReady(page);
    let target = await featurePixel(page, "gpc-points", ["ovl-hit", "desc-points"]);
    if (!target) target = await featurePixel(page, "desc-points", ["ovl-hit", "gpc-points"]);
    expect(target, "a project point is visible on the map").not.toBeNull();
    await page.mouse.click(target!.x, target!.y);
    const involved = opps.filter((o) => o.a.id === target!.id || o.b.id === target!.id);
    await expect(page.getByRole("button", { name: /^Remove filter Project:/ })).toBeVisible();
    if (involved.length) await expect(rows(page)).toHaveCount(involved.length);
    else await expect(page.getByText("No opportunities match")).toBeVisible();
    await page.getByRole("button", { name: /^Remove filter Project:/ }).click();
    await expect(rows(page)).toHaveCount(opps.length);
  });
});

test.describe("plan changes", () => {
  const GROUPS: Record<string, (c: Change) => boolean> = {
    All: () => true,
    Schedule: (c) => c.event === "slipped" || c.event === "moved_earlier",
    Cost: (c) => c.event === "cost_changed",
    Renamed: (c) => c.event === "renamed",
  };
  const MORE: Record<string, (c: Change) => boolean> = {
    "Source conflicts": (c) => c.event === "sources_disagree",
    "New projects": (c) => c.event === "new",
    "Removed / completed / cancelled": (c) => ["removed", "completed", "cancelled"].includes(c.event),
    "Change notes": (c) => c.event === "changed",
    "Reused Project IDs": (c) => c.event === "id_reused",
  };
  const openChanges = async (page: Page) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: /Plan changes/ }).click();
  };
  const summary = (page: Page, shown: number, total: number) => page.getByText(new RegExp(`^${shown} of ${total} changes`));

  test("group buttons, More select, utility buttons, Linked only and search each give the API's count", async ({ page, request }) => {
    const [changes, opps] = await Promise.all([apiData<Change[]>(request, "/changes"), opportunities(request)]);
    const total = changes.length;
    await openChanges(page);
    for (const [name, keep] of Object.entries(GROUPS)) {
      await page.getByRole("group", { name: "Change type" }).getByRole("button", { name, exact: true }).click();
      await expect(summary(page, changes.filter(keep).length, total)).toBeVisible();
    }
    for (const [name, keep] of Object.entries(MORE)) {
      await page.getByLabel("More change types").selectOption(name);
      await expect(summary(page, changes.filter(keep).length, total)).toBeVisible();
    }
    await page.getByLabel("More change types").selectOption("");
    for (const u of ["DESC", "GPC"]) {
      await page.getByRole("group", { name: "Utility" }).getByRole("button", { name: u, exact: true }).click();
      await expect(summary(page, changes.filter((c) => c.utility === u).length, total)).toBeVisible();
    }
    await page.getByRole("group", { name: "Utility" }).getByRole("button", { name: "All", exact: true }).click();
    const linked = new Set(opps.flatMap((o) => [o.a.id, o.b.id]));
    await page.getByLabel("Linked only").check();
    await expect(summary(page, changes.filter((c) => linked.has(c.primary_id ?? c.project_id)).length, total)).toBeVisible();
    await page.getByLabel("Linked only").uncheck();
    await page.getByRole("searchbox", { name: "Search changes" }).fill("okatie");
    const matches = changes.filter((c) => `${c.name} ${c.project_id} ${c.primary_id ?? ""}`.toLowerCase().includes("okatie"));
    await expect(summary(page, matches.length, total)).toBeVisible();
  });

  test("Export CSV downloads exactly the shown rows", async ({ page, request }) => {
    const changes = await apiData<Change[]>(request, "/changes");
    await openChanges(page);
    await page.getByRole("group", { name: "Change type" }).getByRole("button", { name: "Schedule", exact: true }).click();
    const link = page.getByRole("link", { name: "Export CSV" });
    const href = (await link.getAttribute("href"))!;
    const lines = decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, "")).split("\n");
    expect(lines[0]).toBe("project_id,utility,name,event,before,after,evidence");
    expect(lines.length - 1).toBe(changes.filter(GROUPS.Schedule).length);
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("gridpulse_plan_changes.csv");
  });

  test("row opens the drawer; other-change links switch it; Close hides it; affected-opportunity link opens the pair", async ({ page }) => {
    await openChanges(page);
    await page.getByRole("searchbox", { name: "Search changes" }).fill("desc-2529-6367-d-g");
    await page.getByRole("row").filter({ hasText: "Schedule slip" }).first().click();
    const drawer = page.getByRole("complementary", { name: "Change detail" });
    await expect(drawer).toContainText("Source comparison");
    await expect(drawer).toContainText("Schedule slip");
    await drawer.getByRole("button", { name: /^Cost change:/ }).click();
    await expect(drawer.locator(".change-kind")).toContainText("Cost change");
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole("row").filter({ hasText: "Schedule slip" }).first().click();
    const affected = drawer.getByRole("button", { name: /^#\d+ · / }).first();
    const rank = (await affected.textContent())!.match(/^#(\d+)/)![1];
    await affected.click();
    await expect(pairPanel(page)).toContainText(`#${rank.padStart(2, "0")}`);
  });

  test("'N opportunities →' opens the project's first pair", async ({ page }) => {
    await openChanges(page);
    await page.getByRole("searchbox", { name: "Search changes" }).fill("desc-2529-6367-d-g");
    await page.getByRole("button", { name: /^\d+ opportunit(y|ies) →$/ }).first().click();
    await expect(pairPanel(page)).toContainText("Jasper – Okatie 230 kV #2");
  });
});

test.describe("data quality", () => {
  type Issue = { kind: string; message: string; project_id: string };
  const openQuality = async (page: Page) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: /Data quality/ }).click();
  };

  test("issue-type buttons and search show the API's issues", async ({ page, request }) => {
    const quality = await apiData<{ discrepancies: Issue[] }>(request, "/quality");
    const issues = quality.discrepancies;
    await openQuality(page);
    const shown = page.locator(".issue");
    const kinds: Record<string, string> = { All: "", Coordinates: "coordinate_conflict", "Source conflicts": "sources_disagree",
      "Cost tables": "cost_table_mismatch", Dates: "date_normalized", "Reused IDs": "id_reused" };
    for (const [label, kind] of Object.entries(kinds)) {
      await page.getByRole("group", { name: "Issue type" }).getByRole("button", { name: label, exact: true }).click();
      await expect(shown).toHaveCount(issues.filter((d) => !kind || d.kind === kind).length);
    }
    await page.getByRole("group", { name: "Issue type" }).getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search issues" }).fill("mcintosh");
    await expect(shown).toHaveCount(issues.filter((d) => `${d.message} ${d.project_id}`.toLowerCase().includes("mcintosh")).length);
  });

  test("an issue row expands and collapses; its Pair button opens the pair", async ({ page }) => {
    await openQuality(page);
    const row = page.getByRole("button", { name: /MCINTOSH OSM and Sperry/ }).first();
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("GridPulse uses")).toBeVisible();
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    const pairButton = page.getByRole("button", { name: /^Pair #\d+ · / }).first();
    const rank = (await pairButton.textContent())!.match(/#(\d+)/)![1];
    await pairButton.click();
    await expect(pairPanel(page)).toContainText(`#${rank.padStart(2, "0")}`);
  });

  test("validation benchmark lists every answer-key case as passed", async ({ page, request }) => {
    const quality = await apiData<{ acceptance: { details: { overlap_id: string; passed: boolean }[] } }>(request, "/quality");
    await openQuality(page);
    for (const d of quality.acceptance.details) {
      await expect(page.getByRole("row").filter({ hasText: d.overlap_id })).toContainText(d.passed ? "✓ Pass" : "✗ Fail");
    }
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("List / Map / Detail pane switch shows one pane at a time; sidebar nav still works", async ({ page }) => {
    await page.goto("/app");
    const panes = page.getByRole("tablist", { name: "Panels" });
    await expect(rows(page).first()).toBeVisible();
    await panes.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByRole("region", { name: "Map of projects and overlaps" })).toBeVisible();
    await expect(page.getByRole("listbox", { name: "Opportunities" })).toBeHidden();
    await panes.getByRole("tab", { name: "Detail" }).click();
    await expect(pairPanel(page)).toBeVisible();
    await panes.getByRole("tab", { name: "List" }).click();
    await expect(rows(page).first()).toBeVisible();
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: /Plan changes/ }).click();
    await expect(page.getByRole("heading", { name: "Plan changes", level: 1 })).toBeVisible();
  });
});
