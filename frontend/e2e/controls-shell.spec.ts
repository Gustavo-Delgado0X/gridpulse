// Every control on the landing page, the sidebar, the shortcuts dialog and the error-retry path.
import { expect, test } from "@playwright/test";
import { apiData, opportunities, rows } from "./helpers";

test.describe("landing page", () => {
  test("section anchors scroll to their sections", async ({ page }) => {
    await page.goto("/");
    for (const [name, id] of [["Problem", "problem"], ["How it works", "how"], ["Evidence", "evidence"], ["Validation", "validation"]]) {
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page.locator("#how")).toBeInViewport();
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  test("both 'Open the workspace' links open /app; brand goes home; source link is the repo in a new tab", async ({ page }) => {
    await page.goto("/");
    const workspace = page.getByRole("link", { name: "Open the workspace" });
    await expect(workspace).toHaveCount(2);
    for (const index of [0, 1]) {
      await page.goto("/");
      await workspace.nth(index).click();
      await expect(page).toHaveURL(/\/app(#|$)/);
      await expect(page.getByRole("complementary", { name: "Primary" })).toBeVisible();
    }
    await page.goto("/");
    const source = page.getByRole("link", { name: "View the source" });
    await expect(source).toHaveAttribute("href", "https://github.com/Gustavo-Delgado0X/gridpulse");
    await expect(source).toHaveAttribute("target", "_blank");
    await page.getByRole("link", { name: /GridPulse/ }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("sidebar", () => {
  test("nav buttons switch views and show live counts", async ({ page, request }) => {
    const [opps, changes, quality] = await Promise.all([
      opportunities(request),
      apiData<unknown[]>(request, "/changes"),
      apiData<{ discrepancies: unknown[] }>(request, "/quality"),
    ]);
    await page.goto("/app");
    const nav = page.getByRole("navigation", { name: "Workspace" });
    await expect(nav.getByRole("button", { name: `Opportunities ${opps.length}` })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: `Plan changes ${changes.length}` }).click();
    await expect(page.getByRole("heading", { name: "Plan changes", level: 1 })).toBeVisible();
    await expect(nav.getByRole("button", { name: /Plan changes/ })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: `Data quality ${quality.discrepancies.length}` }).click();
    await expect(page.getByRole("heading", { name: "Data quality", level: 1 })).toBeVisible();
    await nav.getByRole("button", { name: /Opportunities/ }).click();
    await expect(rows(page)).toHaveCount(opps.length);
  });

  test("Validated opens the proof; status names the dataset; brand links home", async ({ page, request }) => {
    const [quality, health] = await Promise.all([
      apiData<{ acceptance: { matched: number; expected: number } }>(request, "/quality"),
      apiData<{ data_mode: string }>(request, "/health"),
    ]);
    await page.goto("/app");
    const { matched, expected } = quality.acceptance;
    await page.getByRole("button", { name: `Validated ${matched}/${expected}` }).click();
    await expect(page.getByRole("heading", { name: "Data quality", level: 1 })).toBeVisible();
    await expect(page.getByText(health.data_mode === "db" ? "Live database" : "Seed dataset")).toBeVisible();
    await page.getByRole("complementary", { name: "Primary" }).getByRole("link", { name: "GridPulse" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("collapse and expand persist across reloads; collapsed search expands and focuses", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".shell")).toHaveClass(/shell--collapsed/);
    await page.reload();
    await expect(page.locator(".shell")).toHaveClass(/shell--collapsed/);
    await page.getByRole("button", { name: "Search projects" }).click();
    await expect(page.locator(".shell")).not.toHaveClass(/shell--collapsed/);
    await expect(page.getByRole("searchbox", { name: "Search projects" })).toBeFocused();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "true");
  });

  test("Ctrl+K focuses search; typing filters the queue and returns to Opportunities", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: /Plan changes/ }).click();
    await page.keyboard.press("Control+k");
    const search = page.getByRole("searchbox", { name: "Search projects" });
    await expect(search).toBeFocused();
    await search.fill("thurmond");
    await expect(rows(page).first()).toBeVisible();
    for (const text of await rows(page).allTextContents()) expect(text.toLowerCase()).toContain("thurmond");
  });

  test("Help opens the shortcuts dialog; Close, Escape, backdrop and ? close it", async ({ page }) => {
    await page.goto("/app");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await page.getByRole("button", { name: "Help and keyboard shortcuts" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Help and keyboard shortcuts" }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Help and keyboard shortcuts" }).click();
    await page.mouse.click(5, 5); // the backdrop, outside the dialog box
    await expect(dialog).toBeHidden();
    await page.locator("body").press("?");
    await expect(dialog).toBeVisible();
  });

  test("Settings switches theme and remembers it", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test("Retry reloads the queue after an API failure", async ({ page }) => {
  let fail = true;
  await page.route("**/api/opportunities?*", (route) => (fail ? route.fulfill({ status: 500, body: "{}" }) : route.fallback()));
  await page.goto("/app");
  await expect(page.getByText("Could not load data")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(rows(page).first()).toBeVisible();
});
