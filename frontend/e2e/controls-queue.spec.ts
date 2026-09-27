// Every control in the study bar (metrics, Distance popover) and the opportunity queue.
import { expect, test } from "@playwright/test";
import { distanceButton, expectRowCount, opportunities, pairPanel, rows, shownRanks } from "./helpers";

test.describe("study bar", () => {
  test("each metric shows its live count and filters the queue; clicking again or 'candidates' resets", async ({ page, request }) => {
    const opps = await opportunities(request);
    const t1 = opps.filter((o) => o.tier === "T1").length;
    const same = opps.filter((o) => o.timeline_label === "same_window").length;
    const conflicts = opps.filter((o) => o.flags.includes("sources_disagree")).length;
    await page.goto("/app");
    const metric = (label: string) => page.getByRole("button", { name: new RegExp(`^\\d+ ${label}$`) });
    await expect(metric("candidates")).toHaveText(`${opps.length} candidates`);

    for (const [label, count] of [["must coordinate", t1], ["overlap", same], ["conflicts", conflicts]] as const) {
      await expect(metric(label)).toHaveText(`${count} ${label}`);
      await metric(label).click();
      await expect(metric(label)).toHaveAttribute("aria-pressed", "true");
      await expectRowCount(page, count);
      await metric(label).click();
      await expect(metric(label)).toHaveAttribute("aria-pressed", "false");
      await expectRowCount(page, opps.length);
    }
    await metric("must coordinate").click();
    await metric("overlap").click();
    await metric("candidates").click();
    await expectRowCount(page, opps.length);
    await expect(page.getByRole("button", { name: "Clear all" })).toBeHidden();
  });

  test("Distance popover: method radios re-query the API and relabel the control", async ({ page, request }) => {
    const center = await opportunities(request, 25, "center");
    await page.goto("/app");
    await distanceButton(page).click();
    await page.getByRole("radio", { name: "Project centers" }).click();
    await expect(page.getByRole("radio", { name: "Project centers" })).toHaveAttribute("aria-checked", "true");
    await expect(distanceButton(page)).toHaveAccessibleName("Distance: project centers, 25 miles");
    await expectRowCount(page, center.length);
    await expect(page).toHaveURL(/m=center/);
    await page.getByRole("radio", { name: "Closest points" }).click();
    await expect(distanceButton(page)).toHaveAccessibleName("Distance: closest points, 25 miles");
  });

  test("Distance presets 1/5/10/25/50 each return exactly the API's pairs", async ({ page, request }) => {
    await page.goto("/app");
    await distanceButton(page).click();
    for (const d of [1, 5, 10, 25, 50]) {
      const expected = await opportunities(request, d);
      expect(expected.every((o) => o.touching || o.dist_closest_mi <= d)).toBeTruthy();
      const preset = page.getByRole("button", { name: `${d} mi`, exact: true });
      await preset.click();
      await expect(preset).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(new RegExp(`d=${d}(&|$)`));
      await expectRowCount(page, expected.length);
      expect(await shownRanks(page)).toEqual(expected.map((o) => o.rank));
    }
  });

  test("radius slider moves 1 mi per step between 1 and 50", async ({ page, request }) => {
    await page.goto("/app");
    await distanceButton(page).click();
    const slider = page.getByRole("slider", { name: "Radius in miles" });
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuetext", "1 miles");
    await expectRowCount(page, (await opportunities(request, 1)).length);
    await page.keyboard.press("ArrowRight");
    await expect(distanceButton(page)).toHaveAccessibleName("Distance: closest points, 2 miles");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuetext", "50 miles");
    await expectRowCount(page, (await opportunities(request, 50)).length);
  });

  test("M switches the distance method from the keyboard", async ({ page }) => {
    await page.goto("/app");
    await expect(rows(page).first()).toBeVisible();
    await page.locator("body").press("m");
    await expect(distanceButton(page)).toHaveAccessibleName(/project centers/);
    await page.locator("body").press("M");
    await expect(distanceButton(page)).toHaveAccessibleName(/closest points/);
  });
});

test.describe("queue", () => {
  test("filter box and '/' shortcut narrow by project name", async ({ page }) => {
    await page.goto("/app");
    await expect(rows(page).first()).toBeVisible();
    await page.locator("body").press("/");
    const box = page.getByRole("searchbox", { name: "Filter opportunities" });
    await expect(box).toBeFocused();
    await box.fill("mcintosh");
    await expect(rows(page).first()).toBeVisible();
    for (const text of await rows(page).allTextContents()) expect(text.toLowerCase()).toContain("mcintosh");
    await box.fill("no such project zzz");
    await expect(page.getByText("No opportunities match")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(box).toHaveValue("");
  });

  test("every Filter checkbox narrows the queue, adds a removable chip, and Clear all resets", async ({ page, request }) => {
    const opps = await opportunities(request);
    const cases: [string, number, string][] = [
      ["T1 · Touching", opps.filter((o) => o.tier === "T1").length, "Tier: T1"],
      ["T2 · < 1 mi", opps.filter((o) => o.tier === "T2").length, "Tier: T2"],
      ["T3 · < 5 mi", opps.filter((o) => o.tier === "T3").length, "Tier: T3"],
      ["T4 · ≤ 25 mi", opps.filter((o) => o.tier === "T4").length, "Tier: T4"],
      ["Build windows overlap", opps.filter((o) => o.timeline_label === "same_window").length, "Timing: overlap"],
      ["Source conflict", opps.filter((o) => o.flags.includes("sources_disagree")).length, "Source conflict"],
      ["Approximate location", opps.filter((o) => o.flags.includes("low_confidence_location")).length, "Approximate location"],
      ["New", opps.length, "Status: New"],
      ["Reviewed", 0, "Status: Reviewed"],
      ["Contacted", 0, "Status: Contacted"],
      ["Dismissed", 0, "Status: Dismissed"],
    ];
    await page.goto("/app");
    const filterButton = page.getByRole("button", { name: "Filter opportunities" });
    for (const [label, count, chip] of cases) {
      await filterButton.click();
      await page.getByLabel(label, { exact: true }).check();
      await page.keyboard.press("Escape");
      await expectRowCount(page, count);
      await expect(filterButton).toHaveText(/Filter · 1/);
      await page.getByRole("button", { name: `Remove filter ${chip}` }).click();
      await expectRowCount(page, opps.length);
    }
    await filterButton.click();
    await page.getByLabel("T1 · Touching", { exact: true }).check();
    await page.getByLabel("T3 · < 5 mi", { exact: true }).check();
    await page.keyboard.press("Escape");
    await expectRowCount(page, opps.filter((o) => o.tier === "T1" || o.tier === "T3").length);
    await expect(page.getByText(`${opps.filter((o) => o.tier === "T1" || o.tier === "T3").length} of ${opps.length}`)).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expectRowCount(page, opps.length);
  });

  test("empty state: 'Widen radius to 50 mi' and 'Clear filters' both work", async ({ page, request }) => {
    const wide = await opportunities(request, 50);
    await page.goto("/app#m=closest&d=5");
    await page.getByRole("searchbox", { name: "Filter opportunities" }).fill("zzz-no-match");
    await page.getByRole("button", { name: "Widen radius to 50 mi" }).click();
    await expect(distanceButton(page)).toHaveAccessibleName("Distance: closest points, 50 miles");
    await expect(page.getByRole("button", { name: "Widen radius to 50 mi" })).toBeHidden();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expectRowCount(page, wide.length);
  });

  test("sort select orders by rank, distance and overlap exactly as specified", async ({ page, request }) => {
    const opps = await opportunities(request);
    const dist = (o: (typeof opps)[number]) => (o.touching ? 0 : o.dist_closest_mi);
    const byDistance = opps.toSorted((a, b) => dist(a) - dist(b) || a.rank - b.rank).map((o) => o.rank);
    const byOverlap = opps.toSorted((a, b) => (b.window_overlap_days ?? 0) - (a.window_overlap_days ?? 0) || a.rank - b.rank).map((o) => o.rank);
    await page.goto("/app");
    const sort = page.getByRole("combobox", { name: "Sort opportunities" });
    await sort.selectOption("distance");
    await expect.poll(() => shownRanks(page)).toEqual(byDistance);
    await sort.selectOption("overlap");
    await expect.poll(() => shownRanks(page)).toEqual(byOverlap);
    await sort.selectOption("rank");
    await expect.poll(() => shownRanks(page)).toEqual(opps.map((o) => o.rank));
  });

  test("Compact toggles row density", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Compact" }).click();
    await expect(page.getByRole("button", { name: "Comfortable" })).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page).first()).toHaveClass(/qrow--compact/);
    await page.getByRole("button", { name: "Comfortable" }).click();
    await expect(rows(page).first()).not.toHaveClass(/qrow--compact/);
  });

  test("Export CSV follows the radius and method, and downloads one row per pair", async ({ page, request }) => {
    await page.goto("/app");
    const link = page.getByRole("link", { name: "Export CSV" });
    await expect(link).toHaveAttribute("href", "/api/export/overlaps.csv?d=25&method=closest");
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.url()).toContain("/api/export/overlaps.csv?d=25&method=closest");
    const lines = (await (await request.get(download.url())).text()).trim().split(/\r?\n/);
    expect(lines[0]).toContain("overlap_id,distance_mi,time_gap (day)");
    expect(lines.length - 1).toBe((await opportunities(request)).length);
    await distanceButton(page).click();
    await page.getByRole("button", { name: "5 mi", exact: true }).click();
    await page.getByRole("radio", { name: "Project centers" }).click();
    await expect(link).toHaveAttribute("href", "/api/export/overlaps.csv?d=5&method=center");
  });

  test("row click selects; Open details, Enter and double-click each open the pair; arrows move", async ({ page, request }) => {
    const opps = await opportunities(request);
    await page.goto("/app");
    await rows(page).nth(2).click();
    await expect(rows(page).nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`pair=${opps[2].id}`));
    await page.getByRole("button", { name: `Open details for #${opps[2].rank}` }).click();
    await expect(pairPanel(page)).toContainText(opps[2].a.name);
    await page.getByRole("button", { name: "Back to list" }).click();

    await rows(page).nth(2).focus();
    await page.keyboard.press("ArrowUp");
    await expect(rows(page).nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(rows(page).nth(3)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(pairPanel(page)).toContainText(opps[3].a.name);
    await page.getByRole("button", { name: "Back to list" }).click();

    await rows(page).nth(4).dblclick();
    await expect(pairPanel(page)).toContainText(opps[4].a.name);
  });
});
