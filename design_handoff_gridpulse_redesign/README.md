# Handoff: GridPulse production redesign

## How to use this (read-only integration)
This package was built by *reading* `Gustavo-Delgado0X/gridpulse@main`. Nothing was written to the repo. To integrate:

1. Unzip this folder into the repo root (e.g. `gridpulse/design_handoff_gridpulse_redesign/`).
2. Open Claude Code in the repo and say:
   > Read `design_handoff_gridpulse_redesign/README.md` and implement it in `frontend/`, one step at a time from "Implementation order". Keep all existing tests passing and don't change engine/pipeline/backend logic.
3. Review each step's diff, run `make test` and `make e2e`, then commit.

## About the design files
`GridPulse.dc.html` is a **design reference built in HTML**. It's a prototype that shows the intended look and behavior. It is not production code. Recreate it in the existing React 19 + TypeScript + Vite + MapLibre frontend, using the repo's patterns: `app.css` classes and `tokens.css` variables, not inline styles. The prototype's data is a hand-typed sample. **Always use the real API data** (`types.ts`).

Open it locally: put `GridPulse.dc.html` and `support.js` side by side and open the HTML in a browser. The Tweaks props in the file (`startPage`, `density`, `showFactMarkers`, `simulateState`) switch pages and preview the loading, empty and map-error states.

## Fidelity
**High-fidelity** for layout, hierarchy, typography, spacing and copy. Keep the repo's existing color tokens where they already carry meaning (see Tokens). Replace the prototype's placeholder hexes with those tokens.

## Ground rules (from repo HANDOFF.md and the brief)
- Don't change the ranking, tiers, distances, timeline, flags, triage states, change detection or acceptance logic. This is a presentation-only redesign.
- **Keep the Estimate tab** (`CostEstimator.tsx`). The prototype omitted it; the real product has it.
- **"Must coordinate" stays T1 only** (`filters.summarize`). The prototype counted T1 and T2; follow the repo.
- Keep: the theme toggle (move it into a settings/profile menu), the `SEED`/`LIVE DB` data-mode tag (move it to the header's right side as a dataset-status pill), `?` shortcuts, the `M` method toggle, URL hash state and the mobile pane switch.
- Items labelled **Proposed** in the prototype have no backend support. Either ship them visibly marked "Proposed" or leave them out:
  - "Evidence quality" rating;
  - issue "Mark reviewed" / status;
  - issue "Impact";
  - plan-change → affected-opportunity link (can be derived client-side; see step 5).

## Implementation order
Each step is a separate commit that keeps the tests green.

### 1. Tokens and base type (`styles/tokens.css`, `app.css`)
- Add `--bg-subtle: #efede8` (selected row), `--bg-hover: #f6f4f0`, `--bg-toolbar: #fcfbf9`, `--line-soft: #ece9e3` (row dividers), `--tint-warn: #fbf1d6`, `--line-warn: #e9d59a`, `--radius-md: 6px`, `--radius-lg: 8px`, `--shadow-pop: 0 8px 24px rgba(24,16,17,.12)` (popovers only).
- The type scale replaces the tiny uppercase labels:
  - page title 16/600;
  - panel title 15/600;
  - row project name 13.5/500 (600 when selected);
  - body 13;
  - meta 12–12.5 muted;
  - micro 11 (utility codes, tier badge only).
- Uppercase tracking only on utility codes (`DESC`/`GPC`). Sentence case everywhere else.
- `font-variant-numeric: tabular-nums` for all numbers. Plex Mono only for IDs and page refs (`gpc-20065`, `desc-2428 p.23`), not for distances or dates.
- Selected-row pattern: `background: var(--bg-subtle); box-shadow: inset 3px 0 0 var(--line-strong)`.
- Remove borders from panels. Use `1px var(--line-hairline)` between regions and `var(--line-soft)` between rows.
- Keep the 4px radius on badges and 6px on controls and alerts.

### 2. App shell (`TopBar.tsx`, `App.tsx`)
- Header is 48px on `--bg-toolbar`. From left to right:
  - brand;
  - study button "DESC × Georgia Power ▾" (static for now);
  - nav tabs "Opportunities 52 · Plan changes 322 · Data quality 21", sentence case, 13.5px, with the active one at 600 plus a 2px bottom bar in `--line-strong` and the count as muted 11.5px;
  - flex spacer;
  - search (flex `0 1 280px`, min 160px; it filters opportunities by name);
  - "● Validated 6/6" in `--status-ok`, linking to Data quality (from `quality.acceptance`);
  - data-mode pill;
  - `?`;
  - settings menu (holds the theme toggle).
- **Move Centers/Closest and the radius slider out of the header** into the Opportunities toolbar (step 3).
- Every flex child in the header and toolbars gets `white-space: nowrap; flex-shrink: 0`. Only the search box shrinks. The layout min-width is 1180px.

### 3. Opportunities toolbar (replaces `HeadlineStrip.tsx`)
- 56px bar. Contents, left to right:
  - the title "Savannah / Augusta study", with the lede as a tooltip;
  - a metric strip of four inline buttons: `52 candidates`, `2 must coordinate`, `15 overlap`, `10 conflicts`, each rendered as an 18px/600 number + 12.5px label;
  - flex spacer;
  - "Distance by" plus a segmented control `Closest points | Project centers` (`useRovingRadio`; keep the tooltip explaining the Sperry method);
  - a `Radius 25 mi ▾` popover with presets 1/5/10/25/50 and a slider. Keep min 5 if the API requires it; otherwise allow 1.
- Metrics toggle the existing filters exactly as `HeadlineStrip` does now. The active metric gets a `--bg-subtle` fill. The conflict number is in `--status-warn`.
- The Answer-key KPI moves to the header's "Validated" link.

### 4. Opportunity queue (`OpportunityTable.tsx`)
Convert the table into a list of rows while keeping the `role`/keyboard semantics.
- **Column:** `minmax(380px, 29%)`.
- **Header:** "Opportunities" + "N candidates"; right side: density toggle (Compact/Comfortable) and `Export CSV` (`api.csvUrl`).
- **Toolbar:** search input (`/` focuses it), `Filter` popover (tier T1–T4 with "T3 · < 5 mi" labels, timing overlap, source conflict, low-confidence location, review status), sort select (Rank / Distance / Overlap). Active filters show as removable chips `Tier: T3 ×` plus "Clear all".
- **Row:** a 28px rank column, then:
  - line 1: tier badge + `"< 5 mi · Share logistics"`, plus a triage tag on the right when it isn't `new`;
  - line 2: `● DESC` + project `a.name`, clamped to 2 lines (1 in compact), with the full name in a tooltip;
  - line 3: `■ GPC` + `b.name`;
  - line 4: meta: **3.40 mi** closest · `213-day overlap` / `No overlap` · `517 d in-service gap`;
  - line 5 (conditional): `▲ Source conflict · …` in `--status-warn` for the `sources_disagree` flag; `◇ Approximate endpoint location` for `low_confidence_location`.
- **Padding:** 12px 16px (8px when compact).
- Hovering a row sets `hoveredId` (already wired). ↑/↓ move the selection.
- **Empty state:** "No opportunities match", a reason line naming the radius and method, and buttons `Clear filters` and `Widen radius to 50 mi`.

### 5. Map (`MapView.tsx`, `MapLegend.tsx`)
- On selection:
  - dim unrelated features to 30% opacity;
  - draw the selected pair at 3.5px;
  - label only the selected/hovered endpoints (HTML labels, 12px/500 with a canvas-colored halo, no boxes);
  - draw a dashed `--line-strong` connector between `closest_points`, or between `centers` in center mode, with a dark pill label `3.40 mi`.
- **Controls:**
  - top-left: a stacked `+ / − / Fit` group;
  - top-right: `Hide unrelated` toggle and `Layers ▾` (holds the existing Satellite toggle);
  - bottom-left: a collapsible Legend (Utility: DESC line, GPC line, hollow = approximate; Relationship: selected pair dashed, other projects grey, tier thresholds text);
  - bottom-right: the attribution line.
- Hovering a project shows a small card (utility, name, "N opportunities · click to filter queue"). Clicking it filters the queue to that project.
- Map error: a striped fallback plus the card "Map tiles unavailable… rankings unaffected" and a `Retry` button.

### 6. Inspector (`DetailPanel.tsx`)
The column is `minmax(360px, 27%)`, and the body scrolls.
- **Header row:** `#04` · tier badge · `< 5 mi` · spacer · a triage dropdown `● New ▾` (restyle `TriageControl` as a menu, with the same 4 states) · `Export brief` as a primary dark button · `⋯` more.
- **Recommendation line:** "◆ Share logistics · Same build window" (from the tier plus `timeline_label` via `TIMING_TEXT`).
- **Project pair**, stacked:
  - ● + 15.5/600 `a.name` + "Dominion Energy SC · `id`";
  - a thin vertical connector with "3.40 mi at closest points";
  - ■ + `b.name` + "Georgia Power · `id`".
  - Hovering either one highlights it on the map (set `hoveredId`, or add a `hoveredProjectId`).
- **Stat grid**, 4 columns between hairlines: Closest · Centers · Overlap · In-service gap. The active method's value is 600. Values come from `dist_closest_mi`, `dist_center_mi`, `window_overlap_days` and `in_service_gap_days`.
- **Alert:** one `--tint-warn` block per flag, titled "Schedule conflict detected" / "Source conflict detected". Body text comes from `FLAG_HELP`, with the actions `Review conflicting sources →` (switches to the Evidence tab) and `View plan change` (navigates to Plan changes filtered to that project).
- **Tabs:** Overview · Timeline · Estimate · Evidence N (keep the existing ARIA tab pattern).
  - **Overview:**
    - "Coordination rationale" = the `interpretation` evidence quote (drop the TEMPLATE tag styling; keep the label in a tooltip);
    - a compact `TimelineStrip`;
    - the two `ProjectCard`s rendered as definition lists without card borders.
  - **Timeline:** a larger `TimelineStrip`:
    - year gridlines, bars per utility, a 2px in-service marker;
    - a shaded overlap band labelled "213-day overlap";
    - a dotted prior-date marker when `sources_disagree`;
    - a table with Project / Start / In-service / Source.
  - **Estimate:** the existing `CostEstimator`, restyled.
  - **Evidence:** group by project. Each `EvidenceItem` shows the field (muted), the source ref (mono) and the value. Distinguish the three evidence types with small glyphs (■ fact, □ derived, ◆ interpretation) and a footer legend. When two sources conflict, show a 2-column A/B compare. Then add a "Derived by GridPulse" list naming each method.

### 7. Plan changes (`PlanChangesView.tsx`)
- **Toolbar:** title + "N of 322 changes · M projects · desc-2428 → desc-2529" / search (shrinks) / segmented Change filter (All · Schedule · Cost · Renamed, plus any other `EVENT_TEXT` events present) / segmented Utility filter / `Linked only` toggle / `Export CSV`.
- **Table:** group by `project_id` in two columns:
  - Project (utility code, "2 changes", name, and a link "1 opportunity →" when the project appears in any opportunity's `a.id`/`b.id`; this is computed client-side from the opportunities list);
  - its change rows: Change (glyph + label) · Before → after · **Delta** · Evidence (`source_id p.N → source_id p.N`).
- The table header is sticky.
- **Delta** (client-side, only when both values parse):
  - dates: `+151 days` / `≈ 5.0 mo later`, in `--status-warn` if over 365;
  - costs: `+$4.79M` / `+20.1%`, in warn if over 50%, `--status-ok` if negative;
  - otherwise show nothing.
- **Row click** opens a 380px right drawer containing:
  - Previous / Current / Difference;
  - a Source comparison with 2 cells showing the evidence refs and quotes;
  - other changes to this project;
  - affected opportunities (click → select that pair on Opportunities).

### 8. Data quality (`DataQualityView.tsx`)
- Remove the dark `inverse-strip`.
- **Toolbar:** title + a subtitle ending "conservative: unresolved values are never guessed", and on the right a health strip:
  - 182 Projects parsed;
  - 104 · 57% Located;
  - 78 Not located;
  - 6/6 Validation passed (ok);
  - N Open issues (warn).
- **Left column (38%):**
  - **Location provenance:** a stacked 10px bar plus rows mapping `endpoints_by_precision`:
    - `sperry_provided` → "Sperry-confirmed · CONFIRMED" (ok);
    - `osm_feature` → "OSM-resolved · RESOLVED";
    - `endpoint_proxy`/`regional_approximation` → "Approximate · APPROXIMATE" (warn);
    - `unresolved` → "Unresolved · UNRESOLVED", shown neutral grey, not red.
  - **Sperry validation benchmark "6 / 6 passed":** columns Case · Expected · GridPulse · Difference · In-service gap · Result (`✓ Pass` ok / `✗ Fail` danger).
- **Right column, the issue queue:**
  - toolbar: segmented type filter (All / Coordinate mismatch / Source conflict) and search;
  - a table header Type · Entity and finding · Impact · Status;
  - each row shows the type glyph and label, `message`, `project_id` in mono, the number of affected pairs (computed client-side from opportunities), and Status "Open";
  - clicking a row expands it inline with an A/B/"GridPulse uses" compare (when parsable from the message; otherwise show the message) and buttons `Pair #N · T3 →` that jump to Opportunities.
  - Status and "Mark reviewed" are **Proposed**.

### 9. States
- **Loading:** skeleton rows in the queue plus a shimmering map (keep `Skeleton`).
- **Errors:** the existing `ErrorCard` restyled as the warn/danger alert with Retry.
- **Map failure:** this must not break the list or the inspector.
- **Tests:** update `App.test.tsx`, `components.test.tsx` and the Playwright `operator-flow.spec.ts` selectors for the new labels (sentence case, moved controls).

## Tokens
- **Existing (keep):**
  - `--bg-canvas #f3f1ed`, `--bg-surface #fff`, `--text-primary #181011`, `--text-muted #666`, `--line-hairline #d8d4d4`;
  - `--utility-desc #1a5fa8` (circle), `--utility-gpc #9a4f00` (square);
  - `--status-ok #1e7a4c`, `--status-warn #8a6100`, `--status-danger #b3261e`.
- **Change:** the violet `--overlap` is no longer used for selection or connectors (the brief calls it arbitrary). Use `--line-strong` for those. Keep violet only for focus rings, or replace the focus color with `--utility-desc`.
- **Add:** the tokens listed in step 1.
- **Spacing:** 4/8/12/16/24. **Radius:** 4 (badges), 6 (controls, alerts), 8 (popovers).

## Files
- `GridPulse.dc.html`: the full interactive prototype (all three pages).
- `support.js`: the runtime needed to open the prototype locally.
