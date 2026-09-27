// Every control in the pair panel (back, prev/next, widen, breadcrumb) and the inspector (triage, brief, more menu,
// tabs, alerts, estimator, maps links).
import { expect, test } from "@playwright/test";
import { apiData, GOSHEN, inspector, opportunities, pairPanel, rows, THURMOND } from "./helpers";

const SCHEDULE_PAIR = "desc-2428-6367-d-g__gpc-20277"; // DESC Goshen slipped in the 2025-29 and 2026-30 lists

interface Detail {
  rank: number;
  a: { id: string; name: string };
  b: { id: string; name: string };
  maps_links: { a: string | null; b: string | null };
}

test.describe("pair panel", () => {
  test("Prev/Next step through the ranked pairs and disable at the ends", async ({ page, request }) => {
    const opps = await opportunities(request);
    await page.goto(`/app#pair=${opps[0].id}&m=closest&d=25`);
    const prev = page.getByRole("button", { name: "Previous pair" });
    const next = page.getByRole("button", { name: "Next pair" });
    await expect(pairPanel(page)).toContainText(`1 / ${opps.length}`);
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(pairPanel(page)).toContainText(`2 / ${opps.length}`);
    await expect(inspector(page)).toContainText(opps[1].b.name);
    await expect(page).toHaveURL(new RegExp(`pair=${opps[1].id}`));
    await prev.click();
    await expect(inspector(page)).toContainText(opps[0].b.name);

    const last = opps[opps.length - 1];
    await page.goto(`/app#pair=${last.id}&m=closest&d=25`);
    await expect(pairPanel(page)).toContainText(`${opps.length} / ${opps.length}`);
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();
  });

  test("Widen/Narrow resize the panel; Back, breadcrumb and Escape return to the list", async ({ page }) => {
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    const before = (await page.locator(".col--panel").boundingBox())!.width;
    await page.getByRole("button", { name: "Widen panel" }).click();
    await expect(page.locator("main.two-col")).toHaveClass(/two-col--wide/);
    await expect.poll(async () => (await page.locator(".col--panel").boundingBox())!.width).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Narrow panel" }).click();
    await expect(page.locator("main.two-col")).not.toHaveClass(/two-col--wide/);

    await page.getByRole("button", { name: "Back to list" }).click();
    await expect(rows(page).first()).toBeVisible();
    await page.getByRole("button", { name: "Open details for #1" }).click();
    await pairPanel(page).getByRole("button", { name: "Opportunities", exact: true }).click();
    await expect(rows(page).first()).toBeVisible();
    await page.getByRole("button", { name: "Open details for #1" }).click();
    await page.locator("body").press("Escape");
    await expect(rows(page).first()).toBeVisible();
  });
});

test.describe("inspector", () => {
  test("triage menu sets all four states; each shows in the queue and survives reload", async ({ page }) => {
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    for (const state of ["Reviewed", "Contacted", "Dismissed", "New"]) {
      await inspector(page).getByRole("button", { name: /^Review status:/ }).click();
      await page.getByRole("radio", { name: state }).click();
      await expect(inspector(page).getByRole("button", { name: `Review status: ${state}` })).toBeVisible();
    }
    await inspector(page).getByRole("button", { name: /^Review status:/ }).click();
    await page.getByRole("radio", { name: "Dismissed" }).click();
    await page.getByRole("button", { name: "Back to list" }).click();
    await expect(rows(page).first()).toContainText("Dismissed");
    await page.getByRole("button", { name: "Filter opportunities" }).click();
    await page.getByLabel("Dismissed", { exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(rows(page)).toHaveCount(1);
    await page.reload();
    await expect(inspector(page).getByRole("button", { name: "Review status: Dismissed" })).toBeVisible();
  });

  test("Export brief opens the printable brief for this pair with the estimator values", async ({ page }) => {
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    await inspector(page).getByRole("tab", { name: "Estimate" }).click();
    await inspector(page).getByLabel("Shared corridor (mi)").fill("2");
    const link = inspector(page).getByRole("link", { name: "Export brief" });
    await expect(link).toHaveAttribute("href", new RegExp(`/api/opportunities/${THURMOND}/brief\\?method=closest&.*shared_corridor_mi=2`));
    const [brief] = await Promise.all([page.waitForEvent("popup"), link.click()]);
    await brief.waitForLoadState();
    await expect(brief.locator("body")).toContainText("CANDIDATE FOR HUMAN REVIEW");
    await expect(brief.locator("body")).toContainText("Hooks - Thurmond");
    await brief.close();
  });

  test("More menu copies the pair link and opens each site in maps", async ({ page, context, request }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const detail = await apiData<Detail>(request, `/opportunities/${THURMOND}?method=closest`);
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    await inspector(page).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Copy link to this pair" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    await inspector(page).getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("link", { name: "Open DESC site in maps ↗" })).toHaveAttribute("href", detail.maps_links.a!);
    await expect(page.getByRole("link", { name: "Open GPC site in maps ↗" })).toHaveAttribute("href", detail.maps_links.b!);
    const facts = inspector(page).getByRole("link", { name: "Open in maps ↗" });
    await expect(facts).toHaveCount(2);
    await expect(facts.first()).toHaveAttribute("href", detail.maps_links.a!);
    await expect(facts.first()).toHaveAttribute("target", "_blank");
  });

  test("all four tabs show their section; arrow keys cycle; Full timeline jumps to Timeline", async ({ page }) => {
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    const tab = (name: string) => inspector(page).getByRole("tab", { name: new RegExp(`^${name}`) });
    const panel = inspector(page).getByRole("tabpanel");
    await expect(panel).toContainText("Coordination rationale");
    await tab("Timeline").click();
    await expect(panel.getByRole("table")).toContainText("In-service");
    await tab("Estimate").click();
    await expect(panel.getByRole("region", { name: "Cost and impact estimate" })).toBeVisible();
    await tab("Evidence").click();
    await expect(panel).toContainText("Derived by GridPulse");
    await expect(panel).toContainText("desc-2428 · p.31");
    await tab("Overview").click();
    await tab("Overview").press("ArrowRight");
    await expect(tab("Timeline")).toHaveAttribute("aria-selected", "true");
    await expect(tab("Timeline")).toBeFocused();
    await tab("Timeline").press("ArrowLeft");
    await tab("Overview").press("ArrowLeft");
    await expect(tab("Evidence")).toHaveAttribute("aria-selected", "true");
    await tab("Overview").click();
    await inspector(page).getByRole("button", { name: "Full timeline" }).click();
    await expect(tab("Timeline")).toHaveAttribute("aria-selected", "true");
  });

  test("every estimator input changes the total by the published formula; Assumptions expands", async ({ page }) => {
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    await inspector(page).getByRole("tab", { name: "Estimate" }).click();
    const field = (label: string) => inspector(page).getByLabel(label);
    const total = inspector(page).getByTestId("estimate-total");
    await field("Shared corridor (mi)").fill("0");
    await field("$ per mobilization").fill("100000");
    await field("Avoided mobilizations").fill("2");
    await expect(total).toHaveText("$200,000");
    // 1 mi × 5,280 ft × 82.5 ft ÷ 43,560 = 10 acres; × $1,000/acre = $10,000
    await field("Avoided mobilizations").fill("0");
    await field("Shared corridor (mi)").fill("1");
    await field("ROW width (ft)").fill("82.5");
    await field("Land $/acre").fill("1000");
    await expect(total).toHaveText("$10,000");
    await expect(inspector(page)).toContainText("10.0 acres");
    await inspector(page).getByText("Assumptions", { exact: true }).click();
    await expect(inspector(page).locator("details.assumptions")).toHaveAttribute("open", "");
  });

  test("schedule alert: Review conflicting sources opens Evidence; View plan change opens that project's changes", async ({ page }) => {
    await page.goto(`/app#pair=${SCHEDULE_PAIR}&m=closest&d=25`);
    await expect(inspector(page)).toContainText("Schedule changed in later plan versions");
    await inspector(page).getByRole("button", { name: "Review conflicting sources →" }).click();
    await expect(inspector(page).getByRole("tab", { name: /^Evidence/ })).toHaveAttribute("aria-selected", "true");
    await expect(inspector(page)).toContainText("between plan versions");
    await inspector(page).getByRole("button", { name: "View plan change" }).click();
    await expect(page.getByRole("heading", { name: "Plan changes", level: 1 })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search changes" })).toHaveValue("desc-2428-6367-d-g");
    // desc-2428-6367-d-g is DESC's Jasper – Okatie #2 (Goshen – McIntosh is the GPC side of this pair)
    const names = await page.locator(".changes-group__name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/Jasper – Okatie 230 kV #2/);
  });

  test("source-conflict alert: Review conflicting sources and View plan change go to the SERTP disagreement", async ({ page }) => {
    await page.goto(`/app#pair=${GOSHEN}&m=closest&d=25`);
    const alert = inspector(page).getByRole("note").filter({ hasText: "Source conflict detected" });
    await alert.getByRole("button", { name: "Review conflicting sources →" }).click();
    await expect(inspector(page)).toContainText("Sources disagree");
    await alert.getByRole("button", { name: "View plan change" }).click();
    await expect(page.getByRole("searchbox", { name: "Search changes" })).toHaveValue("gpc-20065");
    await expect(page.getByRole("row").filter({ hasText: "IRP 2027 → SERTP 2026: 2028" })).toBeVisible();
  });
});

test.describe("voice briefing (ElevenLabs)", () => {
  test("hidden when the server has no ElevenLabs key", async ({ page, request }) => {
    const health = (await (await request.get("/api/health")).json()).data;
    test.skip(health.voice === "available", "this server has a key configured");
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    await expect(inspector(page)).toContainText("Hooks - Thurmond");
    await expect(page.getByRole("button", { name: /voice briefing/ })).toHaveCount(0);
  });

  test("when available: transcript comes from the script endpoint and Listen requests this pair's audio", async ({ page }) => {
    await page.route("**/api/health", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, data: { ...body.data, voice: "available" } } });
    });
    const audioRequests: string[] = [];
    await page.route("**/brief/audio?*", (route) => {
      audioRequests.push(route.request().url());
      return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    });
    await page.goto(`/app#pair=${THURMOND}&m=closest&d=25`);
    const panel = inspector(page);
    await panel.getByText("Transcript").click();
    await expect(panel).toContainText("GridPulse briefing. Pair 1");
    await expect(panel).toContainText("page 31");
    await panel.getByRole("button", { name: "Listen to voice briefing" }).click();
    await expect.poll(() => audioRequests.length).toBeGreaterThan(0);
    expect(audioRequests[0]).toContain(`/api/opportunities/${THURMOND}/brief/audio?method=closest`);
    await expect(panel.getByRole("button", { name: "Retry voice briefing" })).toBeVisible();
    await expect(panel.getByRole("status").filter({ hasText: "could not load" })).toBeVisible();
  });
});
