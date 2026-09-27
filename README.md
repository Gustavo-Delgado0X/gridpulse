# GridPulse

Cross-utility planning intelligence for Sperry Tech's **GridLock** challenge (ShellHacks 2026).

GridPulse reads the public transmission plans of **Dominion Energy South Carolina (DESC)** and **Georgia Power (GPC)**. It finds where their planned work overlaps across the Savannah River and ranks those pairs so planners know whom to call first. Every value it shows cites the source page it came from, and it shows what changed between plan versions.

- **Primary signal:** geographic overlap within 25 mi, measured between **closest points**, in four tiers. Sperry's center-to-center method is always shown next to it.
- **Secondary signal:** timeline overlap (shared build windows and the gap in days).
- **Bonus:** a transparent cost/impact estimate with editable assumptions.

> **Answer key: 6/6.** Sperry's `Projects_Overlaps.xlsx` is reproduced exactly: every distance to ±0.01 mi and every day gap exact. The 3 control projects are never flagged. Two automated gates check this:
> - **Gate A** runs on the key's own data.
> - **Gate B** runs on the full dataset built from the PDFs.

## What it finds

| | |
|---|---|
| Projects parsed | 182 (44 DESC 2024–28 + 138 GPC/SAV from the 2025 IRP), plus 70 other-utility rows kept but hidden |
| Projects located | 104 (OpenStreetMap substations, confirmed against PDF context, plus Sperry's coordinates) |
| DESC × GPC pairs within 25 mi (closest points) | 52: **2 × T1**, 2 × T3, 48 × T4. 15 of them share a build window |
| Plan-change events | 322 across DESC 2024–28 → 2025–29 → 2026–30, GPC IRP tables, and IRP vs SERTP 2025/2026 |

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
- Every endpoint carries a precision label (`osm_feature`, `sperry_provided`, `endpoint_proxy`, `regional_approximation`, `unresolved`).

**Engine**
- **Closest points:** nearest points found on EPSG:5070 geometry, then measured geodesically on WGS84.
- **Center-to-center:** haversine with R = 3958.8 mi, which reproduces the key.
- **Tiers:** T1 touching or shared facility · T2 < 1 mi · T3 < 5 mi · T4 ≤ 25 mi.
- **Timeline:** window overlap, day gap, and a timing label.
- **Ranking:** deterministic, by tier, then timing, then gap, then distance, then ID.
- **Estimator:** the cost/impact calculation.

**UI**
- Ranked table, schematic map and detail panel, linked by selection.
- Centers ↔ Closest toggle, with an animated slide on the map.
- Evidence, estimator, triage, brief, CSV export, plan-changes view and data-quality view.

### Design choices

- **Evidence over assertion.** Every fact carries a verbatim quote and a page number. Derived numbers name their method, and interpretations are labelled `TEMPLATE`.
- **Honest locations.** Nothing is geocoded by guesswork: 194 endpoints stay `unresolved` and are listed, not drawn. Coordinate conflicts are reported, for example McIntosh vs West McIntosh (0.41 mi) between OSM and the answer key.
- **Color is never the only signal.** DESC is always a blue circle and GPC an orange square, each with a text label. Tiers use line weight and dash as well as a text badge.

## Run it

Requires Python 3.12 (pinned in `.python-version`) and Node 22.

```bash
make setup      # venv + pip install -r requirements-dev.txt + npm ci
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

## Tests

```bash
make test         # pytest (engine, parsers, locate, build, API, Gate A/B) + Vitest (components, map data)
make acceptance   # Gate A only
```

Tests that need the gitignored PDFs skip cleanly when those files are absent.

## API

- `GET /api/health`
- `GET /api/sources`
- `GET /api/projects?utility=&located=`
- `GET /api/opportunities?d=5..50&tier=&timeline=&method=closest|center`
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
| Sperry `Projects_Overlaps.xlsx` | Acceptance tests, `sperry_provided` coordinates |
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

Because PyMuPDF is AGPL-licensed, the repository's own license must be AGPL-compatible if the pipeline is distributed.

## Disclosures

- **AI assistance:** built with Claude Code (Anthropic) as a pair programmer. All code is written for this project and tested (test-first). No code was copied from other teams.
- **AI features:** the PydanticAI resource-profiler and explainer (plan item P1c) are **not** included in this submission. Explanations are deterministic templates, labelled `TEMPLATE`.
- **Estimates:** cost/impact figures are rough, for discussion only. Right-of-way widths, $/acre and mobilization costs are team assumptions shown in the UI.
- **Planning documents:** `docs/GRIDPULSE_MASTER_STRATEGY.md` and `docs/GRIDPULSE_CONTRACTS_DRAFT.md`.
