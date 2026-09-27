import { expect, test } from "@playwright/test";

const THURMOND = "desc-2428-6810-a__gpc-20793";

test("ranked list opens on the shared Thurmond facility", async ({ page }) => {
  await page.goto("/");
  const firstRow = page.getByRole("table").getByRole("row").nth(1);
  await expect(firstRow).toContainText("Hooks - Thurmond 115kV Tie: Rebuild");
  await expect(firstRow).toContainText("T1");
  const detail = page.getByRole("region", { name: "Selected opportunity" });
  await expect(detail).toContainText("touching");
  await expect(detail).toContainText("T1 · MUST COORDINATE");
  await detail.getByRole("tab", { name: "EVIDENCE" }).click();
  await expect(detail).toContainText("FACT · P.31");
});

test("headline numbers filter the list and the answer-key badge opens the proof", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /MUST COORDINATE/ }).click();
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(3); // header + 2 T1 pairs
  await page.getByRole("button", { name: /ANSWER KEY 6\/6/ }).click();
  await expect(page.getByText("ANSWER KEY 6/6 ✓")).toBeVisible();
});

test("deep link opens the pair and method it encodes", async ({ page }) => {
  await page.goto("/#pair=desc-2428-6367-d-g__gpc-20065&m=center&d=25");
  await expect(page.getByRole("radio", { name: "CENTERS" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "Selected opportunity" })).toContainText("SAV: GOSHEN (SAV) - MCINTOSH");
});

test("brief export carries edited estimator values", async ({ page }) => {
  await page.goto("/");
  const detail = page.getByRole("region", { name: "Selected opportunity" });
  await detail.getByRole("tab", { name: "ESTIMATE" }).click();
  await detail.getByLabel(/Shared corridor/).fill("3");
  await expect(detail.getByRole("link", { name: "Export brief" })).toHaveAttribute("href", /shared_corridor_mi=3/);
});

test("switching to Sperry's center method re-tiers the Thurmond pair", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "CENTERS" }).click();
  await expect(page.getByText(/Center-to-center \(Sperry method\)/)).toBeVisible();
  const detail = page.getByRole("region", { name: "Selected opportunity" });
  await expect(detail).toContainText("T3 · SHARE LOGISTICS");
  await expect(detail).toContainText("4.09 mi");
});

test("keyboard triage: arrow to the next pair and mark it contacted", async ({ page }) => {
  await page.goto("/");
  const rows = page.getByRole("table").getByRole("row");
  await rows.nth(1).focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("radio", { name: "CONTACTED" }).click();
  await expect(rows.nth(2)).toContainText("CONTACTED");
  await page.reload();
  await rows.nth(2).click();
  await expect(page.getByRole("radio", { name: "CONTACTED" })).toHaveAttribute("aria-checked", "true");
});

test("data quality shows the answer-key gate and discrepancies", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DATA QUALITY" }).click();
  await expect(page.getByText("ANSWER KEY 6/6 ✓")).toBeVisible();
  await expect(page.getByText(/MCINTOSH: OSM and Sperry's answer key differ by 0.41 mi/)).toBeVisible();
});

test("plan changes can be filtered to source disagreements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAN CHANGES" }).click();
  await page.getByRole("combobox").selectOption("sources_disagree");
  const row = page.getByRole("row").filter({ hasText: "SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD" });
  await expect(row).toContainText("IRP 2027 → SERTP 2026: 2028");
  await expect(row).toContainText("sertp-2026 p.53");
});

test("brief and CSV exports are served", async ({ request }) => {
  const brief = await request.get(`/api/opportunities/${THURMOND}/brief`);
  expect(await brief.text()).toContain("CANDIDATE FOR HUMAN REVIEW");
  const csv = await request.get("/api/export/overlaps.csv");
  expect((await csv.text()).split("\n")[0]).toContain("overlap_id,distance_mi,time_gap (day)");
});
