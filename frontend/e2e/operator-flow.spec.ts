import { expect, test } from "@playwright/test";

const THURMOND = "desc-2428-6810-a__gpc-20793";
const inspector = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Selected opportunity" });
const rows = (page: import("@playwright/test").Page) => page.getByRole("listbox", { name: "Opportunities" }).getByRole("option");

test("queue opens on the shared Thurmond facility with sourced evidence", async ({ page }) => {
  await page.goto("/app");
  await expect(rows(page).first()).toContainText("Hooks - Thurmond 115kV Tie: Rebuild");
  await expect(rows(page).first()).toContainText("Touching · Must coordinate");
  await page.getByRole("button", { name: "Open details for #1" }).click();
  await expect(inspector(page)).toContainText("Must coordinate");
  await expect(inspector(page)).toContainText("Touching");
  await inspector(page).getByRole("tab", { name: "Evidence" }).click();
  await expect(inspector(page)).toContainText("desc-2428 · p.31");
});

test("toolbar metrics filter the queue and the Validated link opens the proof", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /must coordinate/ }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: /Validated 6\/6/ }).click();
  await expect(page.getByRole("heading", { name: "Data quality", level: 1 })).toBeVisible();
  await expect(page.getByText("Validation passed")).toBeVisible();
});

test("deep link opens the pair and method it encodes", async ({ page }) => {
  await page.goto("/app#pair=desc-2428-6367-d-g__gpc-20065&m=center&d=25");
  await expect(page.getByRole("button", { name: "Distance: project centers, 25 miles" })).toBeVisible();
  await expect(inspector(page)).toContainText("SAV: GOSHEN (SAV) - MCINTOSH");
  await expect(inspector(page)).toContainText("Source conflict detected");
});

test("brief export carries edited estimator values", async ({ page }) => {
  await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
  await inspector(page).getByRole("tab", { name: "Estimate" }).click();
  await inspector(page).getByLabel(/Shared corridor/).fill("3");
  await expect(inspector(page).getByRole("link", { name: "Export brief" })).toHaveAttribute("href", /shared_corridor_mi=3/);
});

test("switching to project centers re-tiers the Thurmond pair", async ({ page }) => {
  await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
  await page.getByRole("button", { name: /^Distance:/ }).click();
  await page.getByRole("radio", { name: "Project centers" }).click();
  await expect(inspector(page)).toContainText("Share logistics");
  await expect(inspector(page)).toContainText("4.09 mi");
});

test("keyboard triage: arrow to the next pair and mark it contacted", async ({ page }) => {
  await page.goto("/app");
  await rows(page).first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await inspector(page).getByRole("button", { name: /Review status/ }).click();
  await page.getByRole("radio", { name: "Contacted" }).click();
  await page.keyboard.press("Escape");
  await expect(rows(page).nth(1)).toContainText("Contacted");
  await page.reload(); // the hash keeps the pair, so the reload reopens its detail
  await expect(inspector(page).getByRole("button", { name: /Review status: Contacted/ })).toBeVisible();
});

test("radius presets and the filter popover narrow the queue; empty state offers a way out", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /^Distance:/ }).click();
  await page.getByRole("button", { name: "5 mi", exact: true }).click();
  await expect(page.getByText("candidates").first()).toBeVisible();
  await page.getByRole("button", { name: "Filter opportunities" }).click();
  await page.getByLabel("T2 · < 1 mi").check();
  await expect(page.getByText("No opportunities match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows(page).first()).toBeVisible();
});

test("data quality issue expands to a source comparison", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /Data quality/ }).click();
  await page.getByRole("button", { name: /MCINTOSH OSM and Sperry/ }).click();
  await expect(page.getByText("GridPulse uses")).toBeVisible();
  await expect(page.getByText("Sperry answer key", { exact: true }).first()).toBeVisible();
});

test("plan changes: schedule filter, drawer and deltas", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /Plan changes/ }).click();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "2025-12-31 → 2026-05-31" }).first();
  await expect(row).toContainText("+151 days");
  await row.click();
  await expect(page.getByRole("complementary", { name: "Change detail" })).toContainText("Source comparison");
});

test("plan changes: IRP vs SERTP disagreement is listed with its evidence", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /Plan changes/ }).click();
  await page.getByLabel("More change types").selectOption("Source conflicts");
  const row = page.getByRole("row").filter({ hasText: "IRP 2027 → SERTP 2026: 2028" }).first();
  await expect(row).toBeVisible();
});

test("brief and CSV exports are served", async ({ request }) => {
  const brief = await request.get(`/api/opportunities/${THURMOND}/brief`);
  expect(await brief.text()).toContain("CANDIDATE FOR HUMAN REVIEW");
  const csv = await request.get("/api/export/overlaps.csv");
  expect((await csv.text()).split("\n")[0]).toContain("overlap_id,distance_mi,time_gap (day)");
});

test("landing page shows live proof numbers and opens the study", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /GridPulse finds where transmission plans meet/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "At a glance" })).toContainText("6 / 6");
  await expect(page.getByRole("figure", { name: "Example opportunity" })).toContainText("3.40 mi");
  await page.getByRole("link", { name: "Open the Savannah / Augusta study" }).click();
  await expect(page).toHaveURL(/\/app#pair=desc-2428-6367-d-g__gpc-20065/);
  await expect(page.getByRole("region", { name: "Selected opportunity" })).toContainText("SAV: GOSHEN (SAV) - MCINTOSH");
});

test("old share links on / still open the workspace", async ({ page }) => {
  await page.goto("/#pair=desc-2428-6810-a__gpc-20793&m=closest&d=25");
  await expect(page.getByRole("region", { name: "Selected opportunity" })).toContainText("Hooks - Thurmond");
});
