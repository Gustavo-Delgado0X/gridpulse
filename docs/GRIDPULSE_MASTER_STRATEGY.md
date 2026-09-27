# GridPulse — Master Strategy and Build Plan (v3)

**Sponsor challenge:** Sperry Tech — **GridLock Challenge**  
**Event:** ShellHacks 2026  
**Submission deadline:** **Sunday, September 27, 2026 — 11:00 AM EDT**. Revised Saturday 22:55 EDT; about **12 hours remain**, with no commits yet.  
**Canonical folder:** `/home/ai/Documents/ChatGPT/Shellhacks Sperry Tech`  
**Companion document:** `GRIDPULSE_CONTRACTS_DRAFT.md` (exact data, engine, API, AI and UX contracts)

> **Revision note (v3).** This version re-bases the plan on Sperry's official GridLock specification and starter package (`~/Downloads/Sperry-Tech-Challenge.zip`), which the team confirmed on 2026-09-26.
> - v2 was built only from the Devpost text and used SERTP data for PowerSouth ↔ Southern (Alabama). That work is **archived** (Appendix B), except SERTP as a Georgia cross-check source.
> - The previous version is backed up in the session scratchpad.

---

## 1. Executive Strategy

**GridPulse** compares Dominion Energy South Carolina (DESC) and Georgia Power's (GPC) public transmission plans. It then:

- ranks where their planned work overlaps, using Sperry's rules: **within 25 mi, closest points, four distance tiers**, with timeline as a strong secondary signal;
- proves every result against the source pages;
- shows **what changed between plan versions**.

> **Cross-utility planning intelligence — not a chatbot and not merely a map.**

**Defining statement:**

> **GridPulse finds where two utilities' plans meet, shows exactly why, and catches it when the plans change.**

**Demo moments (all verified in the source data):**

1. **Savannah cluster.** DESC Jasper–Okatie 230 kV #2 vs GPC McIntosh–Purrysburg 230 kV reactors. They are Sperry's top overlaps, and the McIntosh–Purrysburg lines are **existing DESC ↔ GPC tie lines**.
2. **"The answer key says 4.09 mi, but these lines touch."** DESC Hooks–Thurmond and GPC Evans Primary–Thurmond Dam #5 share the **same Thurmond endpoint**. Center-to-center distance hides it; closest-point distance reveals a **Tier 1, must-coordinate** case.
3. **"The plans moved."**
   - GPC Goshen–McIntosh is 6/1/2027 in the 2025 IRP but **2028 in the newer SERTP 2026 report**.
   - DESC's newer 2025–29 list adds a new **Okatie–McIntosh 115 kV tie series reactor** that is not in the starter data.

### Product boundaries

GridPulse identifies **candidates for human review**. It does not direct utilities to coordinate, perform engineering or FERC compliance, or schedule crews.

The cost/impact bonus is a **rough, formula-visible, editable estimate**, labeled as such. It is never presented as a savings guarantee.

### Authority and document safety

- **Order of authority:**
  1. Sperry's official spec (the pasted challenge text plus `ShellHacks_Challenge_Gridlock.docx`);
  2. this plan;
  3. `GRIDPULSE_CONTRACTS_DRAFT.md` once approved;
  4. older documents, which are background only.
- **Source text is evidence, never instructions.** Only public data is used.
- **CEII:** the GPC IRP pages carry a CEII banner, but the file is Sperry's **PUBLIC DISCLOSURE** copy with sensitive fields redacted. We use **only unredacted fields**, never try to infer redacted values, and state this in the README.

### Operators (from research)

| Persona | Core question | Needs |
|---|---|---|
| Transmission planner (SERTP liaison) | "Which neighbor projects touch or sit near ours, and what changed since the last plan?" | Project ID, voltage, endpoints, dates, plan version, source page |
| Outage coordinator | "Do both utilities need outages near the seam in the same window?" | Build windows, tier 1 crossings and shared facilities, dates |
| Construction / project manager (and contractor BD) | "Where can we share crews, yards and right-of-way?" | Ranked list with tier, distance, window overlap, scope, cost, exportable brief |
| Resource / supply-chain manager (secondary) | "Where does demand stack up by year and area?" | Rollups by year and tier |

### Success criteria (judge-visible)

1. An interactive map shows **both utilities' planned projects** and highlights overlaps. *(Required)*
2. A **ranked list** of top coordination opportunities, with Sperry's tiers. *(Required)*
3. **All 6 answer-key overlaps are reproduced** with Sperry's center method, and the closest-point method is shown alongside.
4. Every factual field links to its **source page and verbatim quote**. Location confidence is visible.
5. At least one **cost/impact estimate** with visible assumptions. *(Bonus)*
6. **Plan-change view:** at least the verified changes in §3.6.
7. **Operator workflow:** triage status, CSV export in Sperry's column layout, and a one-page brief.

---

## 2. Challenge Contract

### Official rules

| Rule | Source | GridPulse implementation |
|---|---|---|
| Compare at least two utilities' public future construction plans | Spec | DESC (SCRTP list) and GPC (2025 IRP Vol 3, 10-year plan) |
| **Geographic overlap within 25 mi (40 km)** | Spec and docx | Candidate gate |
| **Measure closest points, not centers** | Pasted spec | Primary distance |
| **Center-to-center haversine, < 25 mi** | Location guide and answer key | Shown as "Sperry method" for comparison and acceptance |
| **Tiers:** touching/crossing · < 1.6 km (1 mi) · < 8 km (5 mi) · < 40 km (25 mi) | Pasted spec | Tier 1–4 badges and ranking |
| Timeline overlap: same build window; the guide adds "time gap in days" | Spec and guide | Window overlap where windows exist; day gap always |
| Geography is primary; timeline is a strong secondary signal used together with it | Spec | Rank by tier, then timeline, then distance |
| "Expect most of the dataset NOT to overlap" | Spec | Show coverage and non-overlap counts openly |
| **Required:** interactive UI with both utilities' projects and overlaps highlighted | Spec | Map + table + detail panel |
| **Required:** ranked list of top opportunities | Spec | Ranked opportunity table |
| **Bonus:** rough cost/impact estimate | Spec | Right-of-way / mobilization estimator (§3.8) |

### Known inconsistencies in Sperry's materials (surfaced as a strength)

1. **Distance method.** The spec says closest points; the location guide and the answer key use centers. **We compute both.**
2. **OVL_1** is listed at 4.09 mi center-to-center, but the two lines share the Thurmond endpoint, so they are **touching**.
3. **Answer-key data quality:**
   - mixed date formats (text vs Excel serial numbers: 45809 = 2025-06-01);
   - McIntosh appears with two coordinates 0.41 mi apart;
   - the Hooks substation has no coordinates;
   - some DESC in-service dates are already in the past (2023–2024).
4. **Ownership:** the GPC IRP table mixes owners (GPC 129, GTC 57, SAV 16, MEAG 14, DU 2 rows). SAV is Georgia Power's Savannah zone. GTC, MEAG and DU are **other utilities** and are filtered by default.
5. **Plan horizon:** the docx says Georgia Power's IRP is a "20-year plan"; the pasted spec says 10-year. The table itself is the "2024 GA ITS Ten-Year Plan (2025–2034)".

### Acceptance test (must pass before any UI polish)

- Using the answer key's coordinates and the center method, the engine outputs **exactly OVL_1–OVL_6** with distances within ±0.01 mi and the same day gaps.
- The three answer-key non-overlaps (DESC_4 Charleston, GPC_4 Tifton, GPC_5 Jesup) are **not flagged**.
- Using the closest-point method on the same data, OVL_1 is reported as **Tier 1 (shared endpoint)**.

### Judging criteria mapping

| Criterion | How we earn it |
|---|---|
| Completion | Acceptance test passing, deployed, with an M1 slice before any extras |
| Originality | Both distance methods, shared-facility detection, plan-version changes, verified AI resource needs |
| Design | Operator console: ranked table, map and timeline linked; precision always visible |
| Technology | Deterministic spatial/temporal engine, provenance, embedded PydanticAI agents, DigitalOcean deploy |
| Practicality | Triage, CSV in Sperry's layout, a one-page brief to send to the counterpart utility |

---

## 3. Data Strategy

### 3.1 Sources

| # | Source | Role | Notes |
|---|---|---|---|
| 1 | DESC *Planned Transmission Projects $2M and above* **2024–2028** (starter; identical to scrtp.com) | Primary DESC | 44 projects, one per page: ID, description, need, status, planned in-service date, **public cost by year** |
| 2 | GPC **2025 IRP Vol 3 Public Disclosure** (starter): Table 2 (pp.177–191) and project detail pages | Primary GPC | About 218 table rows; 208 detail pages with **Need Date, Start Date**, description, and "Change From Previous Ten Year Plan / IRP". Costs are redacted |
| 3 | `Projects_Overlaps.xlsx` (starter) | Acceptance test | 10 projects, 6 overlaps |
| 4 | DESC **2025–2029** and **2026–2030** lists (scrtp.com, public) | Plan-change view | 47 and 54 projects |
| 5 | SERTP 2025 and 2026 preliminary expansion plans (already downloaded) | GPC date cross-check | Georgia Power (SOCO/SAV) entries only |
| 6 | OpenStreetMap via Overpass / Nominatim (Sperry's recommended approach) | Substation and line locations | ODbL attribution; Nominatim at most 1 request/s, cached, no browser autocomplete |
| 7 | HIFLD transmission lines (**archived Aug 2025**, Esri federal mirror) and EIA-860 plants | Backdrop and corroboration | Attribute the vintage |
| 8 | Census 2025 Gazetteer | Town fallback | Public domain |

### 3.2 Study scope

- **DESC:** all projects in the 2024–28 list (44).
- **GPC:** all rows owned by GPC or SAV are **parsed**. **Locations** are resolved first for projects in the **border study area**: the Savannah (zone 219) and east-Georgia zones near Augusta, plus any row whose endpoint matches an OSM feature within 25 mi of South Carolina. Rows outside the study area are listed as "not located (outside study area)", not silently dropped.
- The UI shows **coverage counts**: parsed, located (by precision), and overlapping.

### 3.3 Records

The exact schema is in the contracts document. Key rules:

- IDs are stable and readable: `desc-2428-p003`, `gpc-teams-20277`.
- **Dates keep their source precision:**
  - DESC: planned in-service date (day).
  - GPC: need date and start date (day). They form the **build window**.
  - DESC build window is derived from the **years with non-zero spend** in its cost table, labeled "derived from cost schedule".
- Ownership comes from the GPC sponsor column or the DESC document identity, never from HIFLD.

### 3.4 Locations

Resolution order, per endpoint. The method is recorded for each one:

1. **OSM substation or line feature** matched by name and operator inside the study-area box. Confirm it against the PDF description (zone, county, landmarks), as Sperry's guide requires.
2. **Answer-key coordinates** for its 10 projects. Recorded as "Sperry-provided".
3. HIFLD line endpoints and EIA plants for corroboration.
4. A town centroid (Census or Nominatim), labeled `regional_approximation`.
5. Otherwise **unresolved**. Timeline-only evaluation applies.

**Geometry:**

- If OSM has the actual line, use it (true closest points).
- Otherwise use a **straight segment between endpoints**, labeled "straight-line proxy".
- Single-station projects are points.

**Precision labels:** `osm_feature` · `sperry_provided` · `endpoint_proxy` · `regional_approximation` · `unresolved`.

### 3.5 Engine (deterministic)

- **Candidate gate:** the two projects belong to different utilities (DESC vs GPC) **and** their closest-point distance is ≤ **25 mi**, or they share a facility.
- **Tiers:**

| Tier | Distance | Meaning |
|---|---|---|
| T1 | touching, crossing, or a shared facility | must coordinate |
| T2 | < 1 mi (1.6 km) | share land |
| T3 | < 5 mi (8 km) | share site logistics |
| T4 | < 25 mi (40 km) | share crews and equipment |

- **Timeline (secondary):**
  - window overlap in days when both windows exist;
  - otherwise the gap between in-service/need dates in days, as the guide specifies.
- **Ranking:** tier, then window overlap (overlapping first), then |day gap|, then closest distance, then stable ID.
- **Both distance methods are stored for every pair:** `dist_closest_mi` and `dist_center_mi` (Sperry method).
- **No model decides** distance, tier, timeline or ranking.

### 3.6 Plan-change view (differentiator)

| Change | Evidence |
|---|---|
| GPC Goshen–McIntosh 115 kV: 6/1/2027 (IRP, answer key) → **2028** | SERTP 2026 p.53 |
| DESC **Okatie – McIntosh 115 kV Tie: Add Series Reactor** — new | DESC 2025–29 list; absent from 2024–28 |
| DESC list growth | 44 → 47 → 54 projects (2024–28 → 2025–29 → 2026–30) |
| GPC per-project changes | "Change From Previous Ten Year Plan / IRP" fields (e.g., McIntosh–Purrysburg: "New Project" vs previous IRP) |

Matching across versions uses the deterministic project key from the contracts document. Uncertain matches go to review; the Project Linker agent is P2.

### 3.7 Evidence model

Every value is one of three types: a **source fact** (with page and quote), a **derived result** (with method), or an **interpretation** (AI or template). The three types are always visually distinct.

When sources disagree (e.g., the IRP date vs the SERTP date), the UI shows a **"sources disagree"** flag rather than picking a winner.

### 3.8 Cost/impact estimate (bonus)

- **DESC side:** **real public costs** from the DESC tables (e.g., Jasper–Okatie #2 and Okatie–Bluffton totals).
- **GPC side:** costs are redacted, so it is marked "not public".
- **Estimator** (editable assumptions, formula shown):
  - **shared right-of-way acres** = shared corridor length × right-of-way width assumption (by voltage);
  - **mobilization savings** = one avoided crew and equipment mobilization × an assumption;
  - **optional:** a percentage of the DESC project cost for shared logistics.
- **Every assumption is shown and editable.** The label is "rough estimate for discussion", never "savings".

### 3.9 Resilience

- The starter PDFs are pinned by SHA-256. Raw PDFs are not committed; their origin is documented.
- Normalized data files are committed.
- The data-status chip reads **Seed / Live DB**.
- Fixture mode works offline.

---

## 4. Frontend (operator console)

This section gives principles only. The detailed UX requirements are in the contracts document (§5). No mockups until the team says to build.

- **Default view:** the **ranked opportunity table** (dense, sortable), linked to the **map** and a **timeline** strip. Selecting a row in any view highlights the others.
- **Map:**
  - DESC and GPC projects in distinct **shapes and colors**;
  - overlaps drawn between their **closest points**;
  - tier styling and a precision legend;
  - optional HIFLD backdrop;
  - a **Centers** toggle for Sperry's method.
  - **2D only (agreed).** Additions for P1d:
    - a **satellite imagery toggle** (USGS, public domain; needs internet, so the offline basemap stays the default);
    - an **existing-grid backdrop** (HIFLD, archived; labeled with its vintage);
    - a **study-area outline** around the Savannah and Augusta border zones.
- **Detail panel:**
  - both projects;
  - tier and both distances;
  - window overlap;
  - evidence quotes with page links;
  - "sources disagree" flags;
  - "Why coordinate?" (AI-verified);
  - the cost estimator;
  - a Google Maps satellite link.
- **Operator tools:**
  - triage status (new / reviewed / contacted / dismissed), stored per browser;
  - CSV export in Sperry's `Projects_Overlaps.xlsx` column layout;
  - a printable one-page brief;
  - a keyboard-first table;
  - a density toggle.
- **Views:** Opportunities (default), Plan changes, Data quality (coverage, answer-key check, discrepancies).
- **Style (locked; contracts §6):** "engineering dossier", adapted from the Pravah style reference.
  - **Light parchment theme by default**, with ink text, 1px lines and no shadows.
  - Uppercase tracked labels and a schematic map.
  - **Color only for DESC (circle), GPC (square) and overlaps (violet)**, always paired with a shape or label.
  - IBM Plex Sans with Plex Mono for numbers.
  - A dark theme is an optional toggle.

---

## 5. Technology Stack

| Layer | Choice | Notes (verified 2026-09-26) |
|---|---|---|
| Extraction | Python **3.12.8** (pyenv), **PyMuPDF 1.28** (AGPL; disclosed), regex parsers | pdftotext is the fallback |
| Locations | Overpass API and Nominatim (cached, 1 request/s), plus reviewed overrides CSV | ODbL attribution |
| Engine | Plain Python + **Shapely** (closest points, segments), haversine | Deterministic; unit-tested |
| Backend | FastAPI, Pydantic v2, uvicorn (`--proxy-headers`), **slowapi** on AI routes | Read-only API |
| AI | **PydanticAI 2.51** pinned: `output_type=`, `retries={'tools':2,'output':2}`, `UsageLimits`, `TestModel` for tests | OpenRouter `openrouter:<vendor>/<model>`; direct Gemini `google:<model>` |
| Frontend | React + TypeScript + Vite, **MapLibre GL v5 (pinned; v6 needs worker config)**, Tailwind | HTML labels (no glyph server needed) |
| Hosting | **DigitalOcean App Platform**: static site plus a $5 Python service, `ingress.rules`, Python pinned to 3.12 | No Dockerfile needed |
| Database (P2) | Tiger Cloud PostGIS | Only if P1 is complete |
| Tests | pytest (acceptance and engine), Playwright smoke test if time allows | |

### Build environment and tooling (verified 2026-09-26 23:45 EDT)

- **Repo scaffold:** `~/Desktop/gridpulse/`. It has 87 placeholder files with no logic, and it is **not a git repo yet**. The docs are copied into its `docs/` folder.
- **Python:** **3.12.8** via the official pyenv (v2.6.22). It is pinned by `.python-version` and `backend/runtime.txt` (for DigitalOcean). Python 3.11.9 is also on the machine but unused.
- **Node** 22.22 / npm 10.9 (nvm). git, pytest, ruff and pdftotext are present. **Missing:** `gh`, `doctl`, `uv`; Shapely and PyMuPDF are installed with pip at build time.
- **Claude Code plugins (user scope):**
  - `ecc@ecc` 2.2.2;
  - `context7` (current library docs);
  - `pyright-lsp` (pyright 1.1.414 installed);
  - `typescript-lsp`;
  - `playwright` (end-to-end smoke test and screenshots);
  - `github` (**needs `GITHUB_PERSONAL_ACCESS_TOKEN`**).
- **ECC usage plan:**
  - `tdd-workflow`/`tdd-guide` for parsers and engine;
  - `python-patterns`, `python-testing` and `fastapi-patterns`;
  - `react-patterns`, `vite-patterns` and `frontend-a11y`;
  - **one reviewer agent pass per work package** (python / typescript / react / fastapi);
  - `security-reviewer` once, before deploy;
  - build-error resolvers only on failure;
  - `deployment-patterns` for P1d;
  - `verification-loop` before submission.
  - Skipped: `orch-*`, `multi-*`, `gan-*`, `council`, planner/architect agents.
- **All product code is hand-written in-session and test-first:** parsers, location pipeline, engine, API, UI, AI agents and README. It is disclosed per ShellHacks rules.

Rejected, with reasons in the v2 notes: LangGraph, CrewAI, Vercel eve, running the product inside an agent harness, and Google Maps as the basemap. Google Maps is used only for satellite **links**.

---

## 6. AI Layer

Unchanged principle: **AI proposes, code verifies, the engine decides.** Two agents plus one LLM call, all bounded, cached and traced.

| Component | Job on the GridLock data | Phase |
|---|---|---|
| **Resource Profiler** (agent) | Read DESC descriptions and GPC detail-page descriptions. Output verified tags (crew, equipment, material, outage-likely, miles), each with a verbatim quote | P1a |
| **Coordination Explainer** (single LLM call) | "Why coordinate?" text from verified facts and tags, citing fact IDs; template fallback | P1a |
| **Project Linker** (agent) | Propose cross-version matches (DESC lists, IRP ↔ SERTP) that the deterministic key can't settle | P2 |

The AI never computes distance, tier, dates or cost. The contracts document holds the schemas, limits and trace format.

---

## 7. API (summary; full schemas in the contracts document)

`GET /health` · `GET /sources` · `GET /projects` · `GET /opportunities` · `GET /opportunities/{id}` · `GET /changes` · `GET /quality` · `GET /export/overlaps.csv` · `GET /opportunities/{id}/brief` · `GET /opportunities/{id}/explanation` *(P1a)* · `GET /agent-runs/{id}` *(P1a)*

Responses use the envelope `{data, error, meta}`. The API is read-only and input-bounded.

---

## 8. Delivery Plan and Cut Line (times in EDT, starting 23:30 Saturday)

### Must — M1: official deliverables and the acceptance test (target 04:00)

| WP | Time | Deliverable |
|---|---|---|
| WP-01 Foundation | 23:30–00:00 | Repo, FastAPI and Vite skeletons, `make dev`, first commit |
| WP-02 Parsers | 23:30–01:00 | DESC 2024–28 parser (44 projects, with costs); GPC Table 2 and detail-page parser (GPC/SAV). Page and quote on every field |
| WP-03 Locations | 00:00–02:00 (parallel) | Overpass/Nominatim pipeline for the study area, overrides CSV, answer-key coordinates, precision labels |
| WP-04 Engine | 01:00–02:00 | Both distance methods, tiers, timeline, ranking |
| **Gate A** | 02:00 | **Acceptance test passes:** 6/6 answer-key overlaps, no false positives on the 3 controls, OVL_1 is T1 under closest-point |
| WP-05 API | 02:00–02:30 | Read-only endpoints, export CSV |
| WP-06 UI | 02:00–04:00 | Ranked table, map, detail panel with evidence, Centers toggle |

### Should — P1 (04:00–07:00), in this order

- **P1a:** cost/impact estimator (bonus) and the one-page brief.
- **P1b:** Plan-change view (DESC versions, IRP vs SERTP, GPC change fields) and the "sources disagree" flags.
- **P1c:** AI Resource Profiler and Explainer, run as a cached batch, plus the audit trail.
- **P1d:** DigitalOcean deploy, triage status, Data-quality view, timeline strip, and the 2D map layers (satellite toggle, HIFLD backdrop, study-area outline).

### Could — P2

- Project Linker agent.
- Tiger Cloud PostGIS.
- Locating GPC projects outside the study area.
- A third utility (Santee Cooper).
- Read-only MCP server.

### Won't

- Authentication.
- Write-back review queue on the server.
- Chatbot.
- Savings guarantees.
- 3D visualization (others already have it; it adds no evidence value).

### Freeze

| Time | Activity |
|---|---|
| **07:30** | **Feature freeze** |
| 07:30–09:30 | Hardening, README (sources, CEII note, licenses, AI disclosure), screenshots, demo recording |
| 09:30–10:30 | Devpost submission with the GitHub link |
| 10:30–11:00 | Buffer |

**If two hours behind:** drop P1c (AI), then P1b. Always keep the bonus estimate.

---

## 9. Testing and Acceptance

- **Acceptance** (Gate A): see §2.
- **Parser snapshot tests:**
  - DESC count is 44, and IDs, dates and costs match their pages;
  - GPC row count matches Table 2;
  - Teams #20277 has Need Date 06/01/2026 and Start Date 01/01/2024.
- **Engine:**
  - tier boundaries (0, 1, 5 and 25 mi exact);
  - a shared endpoint gives T1;
  - unresolved geometry gives no spatial result;
  - same-utility pairs are never flagged;
  - output is deterministic.
- **Change detection:** Goshen–McIntosh is flagged as `sources_disagree` / `slipped`; the Okatie–McIntosh tie is `new` in 2025–29.
- **AI:** unverified quotes are dropped; output falls back to the cache and then the template; tiers are identical with or without AI.
- **Security:** no secrets in git; the API is read-only; AI routes are rate-limited.

---

## 10. Demo Contract (45 s)

| Time | Action |
|---|---|
| 0–8 s | "Sperry gave us DESC's and Georgia Power's public plans. Most projects don't overlap; GridPulse finds the ones that do." Show the ranked table and map. |
| 8–20 s | Select the Savannah cluster: Jasper–Okatie vs McIntosh–Purrysburg. Show the tier, both distances, the build windows, and page-cited quotes. |
| 20–30 s | Toggle **Centers ↔ Closest points** on Hooks–Thurmond: "The answer key says 4.09 mi, but they share Thurmond. That's Tier 1, must coordinate." |
| 30–40 s | Open **Plan changes**: Goshen–McIntosh slipped; a new Okatie–McIntosh tie appeared. |
| 40–45 s | Show the cost estimate with its assumptions, and export the brief. "Deterministic, cited, and ready to send to the other utility." |

---

## 11. Security, Reliability, Ethics

- Secrets live in environment variables or DigitalOcean secrets. The app is read-only. CORS is locked. Inputs are bounded.
- AI routes are rate-limited and cost-capped (OpenRouter key limit).
- **CEII:** only unredacted public-disclosure fields are used. Nothing marked CEII is published beyond what Sperry distributed publicly. Redacted values are never inferred.
- **Attribution:**
  - OpenStreetMap (ODbL);
  - HIFLD (archived, via Esri federal mirror);
  - EIA;
  - Census;
  - SCRTP, SERTP and the Georgia PSC filing.
- **Disclosure:** PyMuPDF is AGPL. External code and AI assistance are disclosed per ShellHacks rules. Other teams' repositories were read only to understand the challenge; no code was reused.

---

## 12. Definition of Done

- The acceptance test passes. The required UI and ranked list are deployed.
- At least one cost/impact estimate is shown with its assumptions.
- Every factual field is cited. Every location states its method and precision.
- The README, attributions, screenshots and demo recording are ready, and Devpost is submitted before 11:00 EDT.
- P1 and P2 items count only if they are finished and stable.

---

## Appendix A — Differentiators vs other GridLock teams (as of 02:30 UTC)

| Others (7 public repos) | GridPulse adds |
|---|---|
| Map + ranked list (common); one team has a 3D world | Both distance methods and shared-facility detection (the Thurmond case) |
| Mostly center-to-center | Closest-point tiers per spec, with Sperry's method shown alongside |
| Single plan snapshot | **Plan-version changes** (DESC 3 versions, IRP vs SERTP, GPC change fields) |
| Some savings estimates | Estimates from **real DESC public costs**, with editable assumptions |
| Little provenance | Page and quote for every field, "sources disagree" flags, a data-quality view |
| — | Operator workflow: triage, brief, Sperry-format CSV |
| — | AI resource needs verified against source quotes |

## Appendix B — Archived v2 work (SERTP, PowerSouth ↔ Southern, Alabama)

- **Kept in `research/` as evidence:** the parser approach, the facility geocoding method, the cross-year key (54% exact match), and the change events.
- **What v3 reuses:**
  - SERTP as a GPC cross-check source;
  - the geocoding and precision method;
  - the cross-version key;
  - the evidence model.
- The Alabama featured cases (GT-001 Lowman, GT-002 Guntersville–Ketona) are **no longer demo material**.
