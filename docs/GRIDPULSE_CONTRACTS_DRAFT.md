# GridPulse — Contracts Draft (v3, for review)

**Status:** DRAFT, planning only, no code. It becomes binding when the team approves it.  
**Basis:** Sperry GridLock spec plus starter package, and `GRIDPULSE_MASTER_STRATEGY.md` v3.  
**Date:** 2026-09-26 23:00 EDT

---

## 1. Data contracts

### 1.1 Sources and pinning

| id | File | Pin |
|---|---|---|
| `desc-2428` | DESC 2024–2028 $2M+ list (starter) | SHA-256 prefix `890876d0faefd405…` (identical to scrtp.com) |
| `desc-2529` | DESC 2025–2029 list (scrtp.com) | Pin at fetch |
| `desc-2630` | DESC 2026–2030 list (scrtp.com) | Pin at fetch |
| `gpc-irp25-v3` | GPC 2025 IRP Vol 3 Public Disclosure (starter), 668 pp | Pin at fetch |
| `sperry-key` | `Projects_Overlaps.xlsx` (starter) | Pin at fetch |
| `sertp-2025`, `sertp-2026` | SERTP preliminary plans | Already pinned (see `research/`) |

### 1.2 DESC parser (one project per page)

Fields, as they appear on every page:

- title line (project name);
- `Project ID` (e.g., `0139 M,N`);
- `Project Description`;
- `Project Need`;
- `Project Status` (`In Progress` / `Planned`);
- `Planned In-Service Date` (M/D/YYYY);
- `Estimated Project Cost`: columns Previous, then one per year, then Total.

**Build window (derived):** the first year with non-zero spend (or "Previous" > 0, meaning it started before the list) through the in-service date. Labeled `window_method: "desc_cost_schedule"`.

Expected counts: 44 / 47 / 54 projects for the three versions. The parser fails loudly if a count differs.

### 1.3 GPC parser

- **Table 2** (pp.177–191). Columns: Zone, Year, TEAMS Number, Project Name (wraps over several lines), Need Date, Project Sponsor, and cost columns (REDACTED, ignored).
  - Keep rows where Sponsor ∈ {GPC, SAV}.
  - Keep other sponsors (GTC, MEAG, DU) as `other_utility`, hidden by default.
- **Detail pages:** keyed by `Teams # NNNNN`. Fields: Need Date, **Start Date**, Description, "Change From Previous Ten Year Plan", "Change From Previous IRP".
  - Supporting Statement and costs are **REDACTED**: never stored and never inferred.
- **Build window:** Start Date → Need Date (`window_method: "gpc_start_need"`).
- **Also parse Table 4** "Completed Projects – Removed" (p.192) for the change view.

### 1.4 Project record

```text
Project {
  id: "desc-2428-0139" | "gpc-20277"
  utility: "DESC" | "GPC" | "other_utility"
  sponsor_raw: str                      # e.g. "SAV", "GPC", "GTC"
  source_id: str, page: int, source_ids_all: [..]
  name: str (verbatim), description: str (verbatim), need_text: str | null
  status: "In Progress" | "Planned" | null
  in_service_date: "YYYY-MM-DD", date_precision: "day" | "year"
  window_start: "YYYY-MM-DD" | null, window_end: "YYYY-MM-DD" | null, window_method: str | null
  voltage_kv: int | null, work_type: new_line|rebuild|reconductor|upgrade|substation|reactor|switching_station|other
  endpoints: [endpoint_id], line_miles: float | null (only if stated in text)
  cost_public: { by_year: {year: usd}, total_usd } | null   # DESC only
  change_notes: { vs_prev_ten_year: str|null, vs_prev_irp: str|null }  # GPC only
  evidence: [{ field, quote, page }]
}
Endpoint {
  id: "sc:okatie", "ga:mcintosh"          # state-scoped; never bare names
  name_raw: [str], lat, lon | null
  precision: osm_feature | sperry_provided | endpoint_proxy | regional_approximation | unresolved
  method: str, source: str, confirmed_by_pdf_context: bool, reviewer: str | null
}
```

### 1.5 Location pipeline (follows Sperry's guide)

1. **Overpass bulk pull**, one query per utility, into GeoJSON:
   - `power=substation` and `power=line` in the study box (about lat 31.9–34.3, lon −83.2 to −80.6);
   - operator regex matches "Georgia Power", "Southern Company", "Dominion", "SCE&G", "SCANA".
2. **Name match:** normalized endpoint names (SUB/SS/TS/DS expansions, dropping zone prefixes like `SAV:`) against OSM `name` tags.
3. **Confirm** each match against the PDF context (zone, county, nearby landmarks), then decide:
   - confirmed → `osm_feature`;
   - ambiguous → keep it with `confirmed_by_pdf_context=false` and a low-confidence badge.
4. **Answer-key coordinates** for the key's 10 projects → `sperry_provided`. Where they conflict with OSM (e.g., the two McIntosh coordinates 0.41 mi apart), store both and flag it.
5. **Fallbacks:**
   - HIFLD (archived) endpoint clustering → `endpoint_proxy` (the method validated in v2: substations resolved where every connected line meets at one point);
   - Census/Nominatim town → `regional_approximation`;
   - otherwise → `unresolved`.
6. Every manual decision goes into `data/overrides/locations.csv` with its evidence.

**Policy:** Nominatim at most 1 request/s, cached, with a custom User-Agent. ODbL attribution in the UI and README.

---

## 2. Engine contracts

### 2.1 Geometry

- Use the OSM line geometry if matched.
- Otherwise use the straight segment between two located endpoints, or a point if only one endpoint is located.
- Otherwise there is no geometry.
- **Center point** (Sperry method): the midpoint of the two endpoints, or the single located point.

### 2.2 Distances (both always computed where possible)

- `dist_closest_mi`: the minimum geodesic distance between the two geometries (Shapely in a local projection, e.g., EPSG:5070, converted to miles).
- `dist_center_mi`: haversine between center points, earth radius 3958.8 mi (reproduces the key to ±0.01).
- **Shared facility:** both projects reference the same `Endpoint.id`, or their located endpoints are within 0.05 mi. The result is `touching=true`.

### 2.3 Candidate gate and tiers

- **Gate:** `utility_a ≠ utility_b` AND (`touching` OR `dist_closest_mi ≤ D`), with **D = 25** (adjustable 5–50).
- **Tiers:**

| Tier | Rule |
|---|---|
| **T1** | touching or crossing |
| **T2** | < 1.0 mi |
| **T3** | < 5.0 mi |
| **T4** | ≤ 25 mi |

- **Sperry comparison flag:** `in_sperry_method = dist_center_mi < 25`. The UI shows when the two methods disagree.

### 2.4 Timeline (secondary)

- `window_overlap_days`: the intersection of the two build windows (if both exist).
- `in_service_gap_days`: |date_a − date_b| (always present; this is the guide's "time gap in days").
- **Label:**
  - "same build window" if `window_overlap_days > 0`;
  - "within 1 year" if the gap is ≤ 365;
  - otherwise "separate timing".

### 2.5 Ranking (deterministic)

Sort by, in order:

1. tier (T1 first);
2. timeline label (same window, then within 1 year, then separate);
3. `in_service_gap_days` ascending;
4. `dist_closest_mi` ascending;
5. opportunity ID.

There is no weighted score. The order is explainable in one sentence.

### 2.6 Acceptance fixtures (Gate A)

- **Inputs:** the answer key's 10 projects with its coordinates and dates.
- **Expected with the center method:** OVL_1–6 with distances 4.09, 5.65, 7.55, 8.01, 14.34, 14.81 mi and gaps 3074, 152, 517, 3074, 365, 730 days. DESC_4, GPC_4 and GPC_5 are not flagged.
- **Expected with the closest-point method:** OVL_1 is T1 (shared Thurmond endpoint).
- **Date parsing:** the Excel serial numbers 45809 and 45778 resolve to 2025-06-01 and 2025-05-01.

### 2.7 Cross-version change detection

- **Project key:** the normalized name.
  - Strip sponsor or zone prefixes and a trailing `, VERB` / `: VERB`.
  - Expand abbreviations and drop stop words.
  - Sort the tokens, then append voltage and phase.
  - Measured on SERTP: 54% exact matches.
- **DESC across versions:** also match on `Project ID` when it's stable (it is the primary key if present).
- **GPC:** match on TEAMS number (a stable ID) across IRP versions. For IRP ↔ SERTP, use the project key and a date comparison.
- **Project-level events:** `new`, `removed`, `completed` (GPC Table 4), `slipped`, `moved_earlier`, `renamed`, `split`, `sources_disagree`.
- **Opportunity-level events:** `new`, `closer` or `farther` (tier change), `timing_converged`, `timing_diverged`, `gone`.

### 2.8 Cost/impact estimator (bonus)

```text
inputs (editable, all shown):
  shared_corridor_mi   = min(line_miles_a, line_miles_b, overlap_length)  # from data; if unknown, user-entered
  row_width_ft         = assumption by voltage (e.g., 115 kV, 230 kV defaults), labeled "assumption"
  mobilization_usd     = assumption per avoided crew/equipment mobilization
outputs:
  shared_row_acres     = shared_corridor_mi * 5280 * row_width_ft / 43560
  land_value_usd       = shared_row_acres * assumed_usd_per_acre (optional)
  mobilization_saved   = mobilization_usd * avoided_mobilizations
  desc_cost_context    = DESC public total for the project (source fact)
```

Every output is labeled "rough estimate for discussion". GPC costs are shown as "redacted in public filing".

---

## 3. API contracts

All responses use `{ "data": ..., "error": null | {code, message}, "meta": {...} }`. Read-only. CORS is locked to the frontend origin.

```text
GET /health → {api:"ok", data_mode:"seed"|"db", ai:"available"|"unavailable", sources_pinned:int}
GET /sources → [{id, title, url, sha256, pages, retrieved_at}]
GET /projects?utility=DESC|GPC&located=true|false&cycle=… → [Project]
GET /opportunities?d=25&tier=T1..T4&timeline=same_window|within_1y|any&method=closest|center
  → [{id, a:ProjectRef, b:ProjectRef, tier, touching, dist_closest_mi, dist_center_mi,
      in_sperry_method, window_overlap_days, in_service_gap_days, timeline_label, rank,
      precision_a, precision_b, flags:[sources_disagree|low_confidence_location|method_disagree]}]
GET /opportunities/{id} → above + evidence[] (type: fact|derived|interpretation), estimator defaults, maps_links
GET /changes?utility=&from=&to= → [{project_id, event, before, after, evidence[]}]
GET /quality → {coverage:{parsed, located_by_precision, unresolved}, acceptance:{passed, details}, discrepancies[]}
GET /export/overlaps.csv → Sperry column layout: overlap_id, distance_mi, time_gap (day), utility_a, project_id_a, project_name_a, utility_b, project_id_b, project_name_b (+ our extra columns at the end)
GET /opportunities/{id}/brief → printable HTML
GET /opportunities/{id}/explanation (P1c) → {text, source:"ai"|"template", fact_ids[], run_id}
GET /agent-runs/{id} (P1c) → trace
```

**Errors:** 400 for out-of-bounds parameters, 404 for an unknown ID, 503 `ai_unavailable` (the UI falls back to the template).

---

## 4. AI contracts

### 4.1 Resource Profiler output

```text
ResourceProfile {
  project_id, tags: [{ group: crew|equipment|material|outage|scope,
                       tag: <vocabulary>, quote: str, page: int }],
  verified: bool, rejected: [{tag, reason}], run_id
}
```

- **Vocabulary:**
  - crew: `line_construction`, `substation_construction`, `protection_controls`, `vegetation_row`;
  - equipment: `conductor_stringing`, `structure_setting`, `breaker_install`, `transformer_install`, `reactor_install`;
  - material: `conductor_acsr`, `conductor_acss`, `structures`, `breakers`, `reactor`, `autotransformer`;
  - outage: `line_outage_likely`, `station_outage_likely`;
  - scope: `miles` (a number, only if stated).
- **Verifier:** the quote must be a verbatim substring of that project's stored text, and the tag must be in the vocabulary. Otherwise the tag is rejected.
- **Inputs:** only unredacted text (DESC description and need; GPC description). GPC supporting statements are redacted and never sent.

### 4.2 Coordination Explainer

- **Input:** the opportunity facts, each with a `fact_id`, plus the verified tags.
- **Output:** `{text ≤ 90 words, fact_ids_cited[]}`. Rejected if it cites an unknown fact ID or states a number that isn't in the facts. Then the template is used.

### 4.3 Limits and traces

- PydanticAI 2.51.
- `UsageLimits(request_limit=4, tool_calls_limit=6)` per run.
- `retries={'tools':2,'output':2}`.
- Batch cost cap and an OpenRouter key limit.
- Traces go to `data/ai/agent_traces.jsonl`: provider, model, input hash, tools, proposals, rejections, latency, cost.

---

## 5. UX requirements (operator-grounded; design comes later, no mockups yet)

| # | Requirement | Why (source) |
|---|---|---|
| U1 | **Ranked, dense, sortable opportunity table is the default view**; the map sits beside it | Planners and schedulers work in list tools (e.g., outage schedulers) |
| U2 | **Table, map and timeline are linked**; selecting in one highlights the others | The core question is space and time together |
| U3 | **Tier badges T1–T4** show text and the resource meaning ("share land") | Sperry's spec defines tiers by what can be shared |
| U4 | **Both distances are visible**, with a **Centers ↔ Closest** toggle and a "methods disagree" flag | Sperry's own documents differ; the Thurmond case |
| U5 | **Every value is traceable:** page and verbatim quote, with a fact / derived / interpretation tag | Planners must defend a flag to the other utility |
| U6 | **Precision is visible** (OSM feature, Sperry-provided, proxy, regional, unresolved) by shape and line style, not color alone | Location data is limited (Sperry guide, Part 2) |
| U7 | **Build windows shown as bars only where sources give them** (GPC start→need, DESC cost years); otherwise date markers | Never fabricate construction windows |
| U8 | **Plan-changes view** with "sources disagree" flags | Plans are republished; Order 1920 information sharing |
| U9 | **Triage status per opportunity** (new / reviewed / contacted / dismissed), stored per browser | Schedule ownership and monitoring reduce delays |
| U10 | **Export CSV in Sperry's layout and a one-page brief** | Coordination happens between organizations and in meetings |
| U11 | **Coverage and honesty panel:** parsed, located, unresolved; answer-key check result | "Most of the dataset will NOT overlap" (spec) |
| U12 | **Muted palette; color reserved for tiers and utilities, always paired with a shape or label;** dark theme first, light print for briefs | ISA-101 high-performance HMI; color-blind safety |
| U13 | **Keyboard-first table** (arrows, Enter, `/` to filter) and a density toggle | Power users triage long lists |
| U14 | **Cost estimator shows its formula and editable assumptions**, labeled "rough estimate" | Bonus criterion without overclaiming |

---

## 6. Design tokens, components and motion (LOCKED 2026-09-26)

**Direction:** "engineering dossier". It adapts the Pravah style reference (`~/Downloads/DESIGN.md`, pravah.com: a grid-AI company in Sperry's domain) to a dense operator console.

- **Principles:**
  - ink on parchment;
  - color only for meaning;
  - uppercase field-note labels;
  - 1px lines with no shadows;
  - a schematic map.
- **Deliberate departures from Pravah:**
  1. A dense data table. Pravah is a marketing site; operators need density.
  2. A monospace face for numbers, because columns need aligned digits.
  3. Three meaning colors, because utilities and overlaps must be distinguishable.
  4. Muted text darkened, because Pravah's Ash `#aaaaaa` is only 2.06:1 on parchment and fails WCAG.

### 6.1 Color tokens: light theme (default)

All contrast values below are measured (WCAG ratios on parchment / white).

| Token | Value | Contrast | Use |
|---|---|---|---|
| `bg.canvas` | `#F3F1ED` parchment | — | App background |
| `bg.surface` | `#FFFFFF` | — | Table, panels, cards |
| `bg.inverse` | `#302023` aubergine | — | **One** inversion strip only (brief header / Data Quality summary). Text on it is white or `#AAAAAA` only (6.66:1) |
| `text.primary` | `#181011` ink | 16.6 / 18.7 | Body, headings, 1px structural lines |
| `text.muted` | `#666666` | 5.09 / 5.74 | Captions, units, metadata (replaces Pravah's Ash) |
| `line.hairline` | `#D8D4D4` bone | 1.30 (decorative) | Dividers only. Never the sole boundary of an interactive control |
| `line.strong` | `#181011` | — | Input and control borders, focus-adjacent lines |
| `utility.desc` | `#1A5FA8` blue | 5.73 / 6.47 | DESC. **Always a circle marker plus the "DESC" label** |
| `utility.gpc` | `#9A4F00` burnt orange | 5.33 / 6.01 | GPC. **Always a square marker plus the "GPC" label** |
| `overlap.accent` | `#6E36B5` violet | 6.51 / 7.35 | Overlap lines, tier badges, selection |
| `focus.ring` | `#6E36B5`, 2px, 2px offset | 6.51 | Keyboard focus, never removed |
| `status.ok` / `warn` / `danger` | `#1E7A4C` / `#8A6100` / `#B3261E` | 4.72–5.79 | **Text and icon only**, never large fills |
| `evidence.ai` | `#0F6E66` teal | 5.41 / 6.10 | "AI · VERIFIED" tag |
| `tint.desc` / `tint.gpc` | `#E3ECF7` / `#F6E9DA` | background only | Selected-row or chip backgrounds, with ink text on top |

**Color-vision rule:** DESC blue and GPC orange differ in lightness by only about 0.01, so they are nearly identical in grayscale. **Shape (circle / square) and a text label are mandatory wherever a utility is shown.**

**Dark theme (optional toggle, not the default):** the earlier dark set is kept:

- canvas `#0B111C`, surface `#111A28`, text `#E7ECF4` / `#AAB6C8` / `#8A97AB`;
- DESC `#4EA8FF`, GPC `#F2A33A`, overlap `#C792FF`.

All of these are 5.4:1 or better.

**Print / brief theme:** white paper, ink text, the same light utility and overlap tokens. The brief header uses the single aubergine inversion strip.

### 6.2 Tier and precision encoding (color-independent)

| Tier | Map line (violet) | Badge (uppercase, tracked) |
|---|---|---|
| T1 Touching / crossing | 4px solid, with a 2px white casing | Filled violet, white text: `T1 · MUST COORDINATE` |
| T2 < 1 mi | 3px solid | 1.5px violet outline: `T2 · SHARE LAND` |
| T3 < 5 mi | 2px dashed (6·4) | 1px violet outline: `T3 · SHARE LOGISTICS` |
| T4 ≤ 25 mi | 1.5px dotted (1·3) | 1px ink outline: `T4 · SHARE CREWS` |

| Location precision | Marker style | Tag |
|---|---|---|
| `osm_feature` | Solid filled | `OSM` |
| `sperry_provided` | Solid, with ink center dot | `SPERRY` |
| `endpoint_proxy` | Hollow (2px stroke) | `PROXY` |
| `regional_approximation` | Dotted halo ring | `REGIONAL` |
| `unresolved` | Not drawn; listed in the table | `UNRESOLVED` |

| Evidence type | Tag style |
|---|---|
| Source fact | `FACT · P.180`: ink outline tag |
| Derived | `DERIVED · CLOSEST-POINT`: ink outline, with the method named |
| Interpretation | `AI · VERIFIED` (teal) or `TEMPLATE` (muted). Body text in italics |

### 6.3 Typography

| Token | Spec |
|---|---|
| `font.ui` | **IBM Plex Sans** 400 / 600 (free substitute for Pravah's ABCfavorit; neutral grotesque) |
| `font.data` | **IBM Plex Mono** 400 / 500 with tabular figures: distances, dates, day gaps, IDs, costs, page references |
| Scale (px) | 12 caption · 13 table body · 14 body · 15 controls · 17 panel lead · 20 panel title · 28 view title · 40 brief title |
| Line height | 1.4 UI · 1.5 body and quotes · 1.2 at 28px and above |
| Tracking | **−0.02em at 28px and above**; **+0.10em on uppercase labels and badges (12px)** |
| Weights | 400 by default; 600 only for headings, selected-row pair names and alert titles. Never for body text |
| Uppercase labels | 12px, +0.10em, padding 2px 8px, 4px radius, white fill with a 1px ink or violet outline. Used for section tags, tiers, evidence and precision |

### 6.4 Spacing, shape, elevation, layout

| Token | Value |
|---|---|
| Spacing | 4-point grid: 4 · 8 · 12 · 16 · 24 · 32 · 48 (the larger Pravah steps, 64+, are for the brief only) |
| Radius | **4px** on cards, badges, inputs and table containers. **100px pill** only on the primary call to action ("Export brief") |
| Elevation | **None.** Depth comes from tone (parchment → white) and 1px lines. Map popovers are the one exception: `0 4px 20px rgba(0,0,0,.12)` |
| Table density | Comfortable 40px rows; **Compact 28px** (toggle) |
| Layout at 1440 | Top bar 56 (bone bottom hairline) · table 520 · map fluid · detail panel 400 · timeline strip 160 |
| Targets | Controls at least 32px on desktop; 44px when collapsed or on touch |
| Icons | 1.5px stroke line icons in ink, 16/20px. No emoji, no filled glyph sets |

### 6.5 Map style (schematic)

- **Base:** parchment background. State and county boundaries in 1px `#D8D4D4`; the state line in 1px ink at 40% opacity.
- **Existing grid** (HIFLD, archived, optional): 0.75px `#666666` at 35% opacity, labeled with its vintage.
- **Projects:** DESC circles and lines in blue, GPC squares and lines in orange. Line widths 2px (planned) and 3px (selected).
- **Overlaps:** violet lines drawn between the **closest points**, styled by tier (§6.2). The **Centers** mode draws dashed ink lines between center points.
- **Labels:** HTML labels (no glyph server): Plex Sans 12px ink on a white 4px tag.
- **Study area:** a 1px dashed ink outline with a `STUDY AREA · SAVANNAH / AUGUSTA` label.
- **Satellite toggle** (USGS): project, overlap and label styling unchanged; a white casing is added to lines for legibility.

### 6.6 Components (final inventory)

| Component | Contract |
|---|---|
| **TopBar** | Parchment, bone bottom hairline. Logo lockup and view tabs (OPPORTUNITIES · PLAN CHANGES · DATA QUALITY), the **Centers ↔ Closest** segmented control, the 25-mi slider, and a data-status tag (`SEED` / `LIVE DB`) |
| **OpportunityTable** | White surface. Columns: rank · tier badge · pair (utility chips) · closest mi · center mi · timing · day gap · flags · triage. Sortable, keyboard-first (↑↓, Enter, `/`), density toggle. Selected row: violet 2px left rule plus `tint.*` background |
| **UtilityChip** | Shape plus uppercase label plus color, e.g., `■ GPC` |
| **TierBadge / EvidenceTag / PrecisionTag** | The uppercase label pattern from §6.2 |
| **MapView / MapLegend** | Per §6.5. The legend explains every encoding in text |
| **TimelineStrip** | Build-window bars only where sourced (GPC start→need; DESC spend years); otherwise ink date markers. A `WINDOW OVERLAP · N DAYS` tag |
| **DetailPanel** | White card: both projects, both distances, timing, flags, evidence list, estimator |
| **InsetAlertCard** (Pravah pattern) | White, 1px bone border, 4px radius, 16px padding: an uppercase tag, a 14px 600 title, and a 12–13px muted explanation. Used for `SOURCES DISAGREE`, `METHODS DISAGREE`, `LOW-CONFIDENCE LOCATION` and `AI UNAVAILABLE` |
| **EvidenceItem** | Tag, verbatim quote in 14px/1.5, and a `P.N ↗` mono link |
| **CoordinateCard** (P1c) | `AI · VERIFIED` resource tags with quotes, the explainer text in italics, and a collapsible audit trail in mono 12px |
| **CostEstimator** | Formula line in mono, editable assumption inputs (4px, ink border), `ROUGH ESTIMATE` tag. The DESC public cost is shown as a FACT; GPC shows "redacted in public filing" |
| **TriageControl** | Segmented control: NEW · REVIEWED · CONTACTED · DISMISSED (per browser) |
| **ExportMenu** | The only **pill** call to action: `Export brief`; secondary: `CSV (Sperry format)` |
| **PlanChangesView** | Change rows: an event tag (SLIPPED / NEW / RENAMED / COMPLETED / DISAGREE), before → after in mono, and evidence |
| **DataQualityView** | The **aubergine inversion strip** summary: coverage counts and `ANSWER KEY 6/6 ✓`. Below it, a discrepancy list of inset alert cards |
| **Brief** (print) | White paper, aubergine header strip, 40px title, both projects, tier, distances, windows, evidence, estimate, `CANDIDATE FOR HUMAN REVIEW` tag |
| **States** | Empty: `NO OVERLAPS AT THIS THRESHOLD`, plus a hint. Loading: hairline skeleton rows. Error: an inset alert card with retry. Offline: a `SEED FIXTURE` tag |

### 6.7 Motion

The principle: motion only explains a change of state. It is never decorative.

| Token | Value | Use |
|---|---|---|
| `motion.fast` | 120ms, ease-out | Hover, focus, row highlight |
| `motion.base` | 200ms, `cubic-bezier(.2,0,0,1)` | Panel content swap, segmented controls, dropdowns |
| `motion.map` | ≤ 600ms fly-to | Fit the selected pair's bounds |
| `motion.method` | 300ms | **Centers ↔ Closest:** overlap lines slide from center points to closest points (the Thurmond "4.09 mi → touching" moment) |
| `motion.change` | 400ms | Plan changes: a date marker slides from its old position to the new one |

- No looping, pulsing, parallax, gradients or dithered hero imagery in the app.
- **`prefers-reduced-motion`:** all transitions become instant, and fly-to becomes a jump.

### 6.8 Accessibility checklist (binding)

- Text contrast at least 4.5:1 (all tokens above are verified). Non-text UI boundaries at least 3:1, using ink for control borders, never bone.
- Utility, tier and precision are never encoded by color alone (shape, line style and text are mandatory).
- Real `<button>`, `<a>` and `<input>` elements. Visible focus ring. Map features are also reachable through the table.
- `lang="en"`. Table headers are scoped. Live region announces the selected pair.

---

## 7. Open items for the team

1. **Study-area bounding box:** confirm it covers Augusta, Thomson, Savannah and Beaufort.
2. **Right-of-way width and mobilization-cost defaults:** find a public source, or label them clearly as team assumptions.
3. **AI model:** run the model comparison on 4 real DESC descriptions (WP-A1), then pick.
4. **DESC 2026–30 as the primary list?** It's newer, but the starter uses 2024–28. **Recommendation:** keep 2024–28 as primary so the acceptance test lines up, and use the newer lists for the change view.
