// Captures the three product screenshots on the landing page from the running app, so they always show real data.
// Usage: start the API and web app (make dev), then: node scripts/landing-shots.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = new URL("../public/landing/", import.meta.url).pathname;
const FEATURED = "desc-2428-6367-d-g__gpc-20065"; // same pair as the landing page's Evidence section
const SIZE = { width: 1600, height: 940 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, reducedMotion: "reduce" });
const nav = (name) => page.getByRole("navigation", { name: "Workspace" }).getByRole("button", { name: new RegExp(name) });
const shoot = (name) => page.screenshot({ path: `${OUT}${name}.jpg`, type: "jpeg", quality: 82 });

await page.goto(`${BASE}/app#pair=${FEATURED}&m=closest&d=25`);
await page.getByRole("region", { name: "Selected opportunity" }).waitFor();
await page.waitForFunction(() => window.__gridpulseMap?.isStyleLoaded() && window.__gridpulseMap.areTilesLoaded());
await page.waitForTimeout(800);
await shoot("opportunities");

await nav("Plan changes").click();
await page.getByRole("group", { name: "Change type" }).getByRole("button", { name: "Schedule", exact: true }).click();
await page.locator(".changes-group").filter({ hasText: "Jasper – Okatie 230 kV #2" }).getByRole("row").first().click(); // a change with linked pairs
await page.getByRole("complementary", { name: "Change detail" }).waitFor();
await shoot("plan-changes");

await nav("Data quality").click();
await page.getByRole("heading", { name: "Data quality", level: 1 }).waitFor();
await shoot("data-quality");

await browser.close();
console.log(`wrote ${OUT}{opportunities,plan-changes,data-quality}.jpg from ${BASE}`);
