# GridPulse

Cross-utility planning intelligence for Sperry Tech's **GridLock** challenge (ShellHacks 2026).

GridPulse reads the public transmission plans of **Dominion Energy South Carolina (DESC)** and **Georgia Power (GPC)**. It finds where their planned work overlaps across the Savannah River and ranks those pairs so planners know whom to call first. Every source fact it quotes cites its page, every derived value names its method, and it shows what changed between plan versions.

- **Primary signal:** geographic overlap within 25 mi, measured between **closest points**, in four tiers. Sperry's center-to-center method is always shown next to it.
- **Secondary signal:** timeline overlap (shared build windows and the gap in days).
- **Bonus:** a transparent cost/impact estimate with editable assumptions.

> **Answer key: a benchmark, never a data source.** No coordinate from Sperry's `Projects_Overlaps.xlsx` is used to place a project. It is checked two ways:
> - **Distance math (Gate A), 6/6:** on the key's own coordinates, every distance is reproduced to ±0.01 mi, every day gap exactly, and the 3 control projects are never flagged.
> - **Independent locating (Gate B), 6/6 found:** on GridPulse's own OpenStreetMap locations, all six answer-key pairs are found in the ranked list with exact day gaps. Four center distances differ from the key because Okatie substation is not in OpenStreetMap and stays unresolved.

## What it finds

| | |
|---|---|
| Projects parsed | 182 (44 DESC 2024–28 + 138 GPC/SAV from the 2025 IRP), plus 70 other-utility rows kept but hidden |
| Projects located | 100 (OpenStreetMap substations matched by name — confirmed by GPC zone, voltage or tie-line context where available — plus two reviewed OSM overrides). 82 are listed but not mapped |
| DESC × GPC pairs within 25 mi (closest points) | 39: **2 × T1**, 2 × T3, 35 × T4. 12 of them share a build window |
| Plan-change events | 317 across DESC 2024–28 → 2025–29 → 2026–30, GPC IRP tables, and IRP vs SERTP 2025/2026 |
| Data-quality issues | 41: source conflicts, coordinate mismatches, cost tables that do not sum, normalized dates, reused Project IDs |

What the ranked list shows that the answer key does not:

- **Thurmond is a shared facility (T1).** Sperry's center method puts DESC's Hooks–Thurmond tie 4.09 mi from GPC's Evans–Thurmond #5 rebuild. Under closest points they touch, because both end at the same Thurmond substation. GPC's **Thurmond #6** rebuild touches it as well, and that pair is not in the answer key.
- **Sources disagree on Goshen–McIntosh.** It's Sperry's OVL_3 partner. The IRP need date is 2027, but SERTP 2026 lists it in 2028, so the opportunity carries a `SOURCES DISAGREE` flag.
- **A new DESC tie into GPC's McIntosh.** "Okatie – McIntosh 115 kV Tie: Add Series Reactor" appears in the DESC 2025–29 list and isn't in 2024–28.
- **Savannah-area pairs outside the key.** For example, Okatie–Bluffton vs Deptford–Magnolia share a build window 16 mi apart.

## How it works

```
data/raw PDFs ──► pipeline/ parse ──► locate (OSM) ──► answer key + overrides ──► engine/ ──► data/processed/*.json ──► backend/ API ──► frontend/
```

| Stage | Where | Notes |
|---|---|---|
| Parse | `pipeline/parse_desc.py`, `parse_gpc.py`, `parse_sertp.py`, `parse_answer_key.py` | Details below this table |
| Locate | `pipeline/fetch_sources.py`, `pipeline/locate.py` | Details below this table |
| Engine | `engine/` | Pure functions, detailed below |
| Changes | `engine/changes.py` | DESC versions matched by Project ID; GPC by TEAMS and a normalized project key against SERTP |
| API | `backend/app/` | FastAPI, read-only, `{data, error, meta}` envelope, rate-limited |
| UI | `frontend/` | React + TypeScript + Vite + MapLibre GL v5, detailed below |

**Parse**
- **DESC lists:** one project per page, handling several quirks:
  - an impossible date (`04/31/26`);
  - phased dates;
  - a cost stated in prose instead of a table;
  - a Project ID reused for a different project.
- **GPC IRP:**
  - Table 2 (208 rows) and the 208 `Teams #` detail pages;
  - Table 3 (cancelled) and Table 4 (completed).
- Expected counts are asserted, so the parser fails loudly if they drift.

**Locate**
- Overpass queries pull every `power=substation|plant` feature per state.
- Names are normalized, then narrowed by GPC planning zone and the project's voltage.
- The neighbouring state is searched only for tie lines or when the zone confirms the match.
- Every endpoint carries a precision label (`osm_feature`, `endpoint_proxy`, `regional_approximation`, `unresolved`). No endpoint takes its coordinates from the answer key.

**Engine**
- **Closest points:** nearest points found on EPSG:5070 geometry, then measured geodesically on WGS84.
- **Center-to-center:** haversine with R = 3958.8 mi, which reproduces the key.
- **Tiers:** T1 touching or shared facility · T2 < 1 mi · T3 < 5 mi · T4 ≤ 25 mi.
- **Timeline:** window overlap, day gap, and a timing label.
- **Ranking:** deterministic, by tier, then timing, then gap, then distance, then ID.
- **Estimator:** illustrative cost/impact arithmetic. The shared corridor defaults to 0 because no source states that two projects share one; users enter a length to explore.

**UI**
- Ranked queue, schematic map and inspector, linked by selection.
- Centers ↔ Closest toggle, with an animated slide on the map.
- Evidence, estimator, triage, brief, CSV export, plan-changes view and data-quality view.

### Design choices

- **Evidence over assertion.** Every source fact is quoted as printed (dates like `6/1/2027` included) with its page; a test checks each quote against its cited PDF page. Derived numbers name their method, and interpretations are labelled `TEMPLATE`.
- **Honest locations.** Ambiguous or unmatched names are not guessed: 204 endpoints stay `unresolved` and are listed, not drawn. When several OpenStreetMap features share a name and nothing (zone, voltage, tie line) picks one, the endpoint stays unresolved. Coordinate conflicts are reported, for example two McIntosh coordinates 0.41 mi apart (OpenStreetMap vs Sperry's answer key); GridPulse keeps the OpenStreetMap one.
- **One list for ranking, all lists for change.** Opportunities are ranked on the DESC 2024–28 list, the edition Sperry's answer key uses. The 2025–29 and 2026–30 lists feed the plan-change view, and the inspector shows when a later list moves a date.
- **Color is never the only signal.** DESC is always a blue circle and GPC an orange square, each with a text label. Tiers use line weight and dash as well as a text badge.

## Run it

Requires Python 3.12 (pinned in `.python-version`) and Node 22.

```bash
make setup      # venv + pip install -r requirements-dev.txt + npm ci  (API-only deps: requirements.txt)
make dev        # API on :8000 and web on :5173 (Vite proxies /api)
```

Open http://localhost:5173. The processed dataset is committed, so the app runs without the raw PDFs.

Rebuilding the data needs the source files. They're gitignored and pinned by SHA-256 in `data/sources.yaml`:

```bash
# data/raw/starter/  <- unzip Sperry's starter package here
# data/raw/          <- desc_2025-2029.pdf, desc_2026-2030.pdf, sertp_2025/2026_preliminary_non_ceii.pdf
.venv/bin/python -m pipeline.fetch_sources   # OSM substations -> data/cache/ (once)
make pipeline                                # -> data/processed/*.json
```

## Deploy (Vercel)

Live: **https://gridpulse-five.vercel.app**

`vercel.json` builds the frontend to static files and serves the API from one Python function (`api/index.py`), which is bundled with `data/processed`. From the repo root:

```bash
npx vercel login     # once per machine
npx vercel --prod
```

## Tests

```bash
make test         # pytest (engine, parsers, locate, build, API, Gate A distance math, Gate B independent locating) + Vitest
cd frontend && npx playwright test   # E2E: every button, filter, link and map control against the live API
make acceptance   # Gate A only
```

Tests that need the gitignored PDFs skip cleanly when those files are absent.

## API

- `GET /api/health`
- `GET /api/sources`
- `GET /api/projects?utility=&located=`
- `GET /api/opportunities?d=1..50&tier=&timeline=&method=closest|center`
- `GET /api/opportunities/{id}`
- `GET /api/opportunities/{id}/brief` (printable HTML)
- `GET /api/changes?utility=&event=`
- `GET /api/quality`
- `GET /api/export/overlaps.csv`: Sperry's column layout, with GridPulse columns appended

## Data sources and attribution

| Source | Use |
|---|---|
| DESC *Planned Transmission Projects $2M and above* 2024–28 (Sperry starter, identical to scrtp.com), 2025–29 and 2026–30 (scrtp.com) | DESC projects, costs, change view |
| Georgia Power 2025 IRP Volume 3, **Public Disclosure** copy (Sperry starter) | GPC projects |
| SERTP 2025 and 2026 preliminary expansion plans, non-CEII (southeasternrtp.com) | Cross-source date check |
| Sperry `Projects_Overlaps.xlsx` | Benchmark only: Gate A distance math, Gate B pair check, coordinate-conflict reports (never used as locations) |
| © OpenStreetMap contributors, ODbL 1.0 | Substation locations |
| U.S. Census Bureau cartographic boundaries via `us-atlas` | Schematic map outlines |
| USGS The National Map imagery | Optional satellite layer |

**CEII note.** The GPC IRP pages carry a CEII banner. GridPulse reads only the unredacted fields of the public-disclosure copy. REDACTED supporting statements and costs are never stored or inferred, and a test asserts that no processed file contains redacted text.

## Third-party licenses

- PyMuPDF (**AGPL-3.0** or commercial)
- FastAPI, Pydantic, Starlette (MIT)
- Shapely, pyproj (BSD/MIT)
- openpyxl (MIT)
- slowapi (MIT)
- React (MIT)
- MapLibre GL JS (BSD-3-Clause)
- us-atlas and topojson-client (ISC)
- IBM Plex fonts (OFL-1.1)

**GridPulse is licensed under the GNU AGPL-3.0** (see `LICENSE`), which keeps the repository compatible with PyMuPDF's AGPL license.

## Disclosures

- **AI assistance:** built with Claude Code (Anthropic) as a pair programmer. All code is written for this project; no code was copied from other teams. An independent review with the Codex CLI flagged overclaims and data-integrity issues, which were fixed and are covered by tests.
- **AI features:** the PydanticAI resource-profiler and explainer (plan item P1c) are **not** included in this submission. Explanations are deterministic templates, labelled `TEMPLATE`.
- **Estimates:** cost/impact figures are illustrative arithmetic, not forecasts. Right-of-way widths, $/acre and mobilization costs are team assumptions (not sourced from either utility), shown and editable in the UI.
- **Planning documents:** `docs/GRIDPULSE_MASTER_STRATEGY.md` and `docs/GRIDPULSE_CONTRACTS_DRAFT.md`.
