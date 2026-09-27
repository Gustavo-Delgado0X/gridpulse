# GridPulse: Session Handoff

## ▶ BUILD STATUS (updated 2026-09-27 ~05:30 EDT). Read this first.

**Built, deployed and audited.** `main` is pushed to the private repo https://github.com/Gustavo-Delgado0X/gridpulse (all commits authored by **Gustavo Delgado**) and live at https://gridpulse-five.vercel.app (landing at `/`, workspace at `/app`).
- Tests: 195 pytest (engine/pipeline/app + frontend API contract), 58 Vitest, 57 Playwright E2E (every control, checked against live API data) — all passing.
- Gate A (distance math on the key's coordinates, 6/6) and Gate B (our own OSM locations find all 6 key pairs; key coordinates are never used as locations) pass; `tests/test_evidence_verbatim.py` checks every quoted fact against its PDF page.
- Current data: 182 projects (100 located), 39 DESC × GPC pairs within 25 mi (2 T1, 2 T3, 35 T4), 317 plan-change events, 41 data-quality issues. Okatie is not in OSM, so it stays unresolved.

**Done:** WP-01–WP-06; P1a estimator + brief; P1b plan changes; P1d data-quality view, satellite layer; production redesign and landing page (design handoffs in `design_handoff_*`); AGPL-3.0 license; Vercel deploy (`vercel.json`, `api/index.py`).
**Audits:** reviewer agents, a judge-style UI review, and a Codex CLI data-integrity audit. Fixed: SERTP key collisions, reused DESC Project IDs, change↔opportunity linking (`primary_id`), dates quoted as printed, ambiguous locations left unresolved, estimator no longer assumes a shared corridor, parser anomalies reported, UI/README overclaims removed.
**Ranking list:** opportunities use DESC 2024–28 (the edition Sperry's answer key uses); later DESC lists feed Plan changes and the inspector's "later plan" markers.

**Still open (user decisions):**
1. **Repo visibility:** private until the user says to make it public (`gh repo edit --visibility public`; gh is at `~/.local/bin`).
2. **Devpost:** screenshots, demo recording and submission before 11:00 EDT.
3. **P1c AI agents:** cut (no API key); explanations are deterministic and labelled TEMPLATE.
4. **Redeploy after changes:** `npx vercel --prod` from the repo root (Vercel is not git-connected).

**Run it:** `make dev`, then open http://localhost:5173. Other targets: `make test`, `make e2e`, `make pipeline` (rebuilding needs `data/raw` and `data/cache`).

**Planning estimate corrected:** GPC Table 2 has **208** rows (122 GPC, 54 GTC, 16 SAV, 14 MEAG, 2 DU), not 218. The extra 10 in the planning estimate are Table 3's cancelled rows.

---


**Written:** 2026-09-26 23:50 EDT, at the end of the planning session.
**Deadline:** **Sunday 2026-09-27, 11:00 AM EDT** (Devpost submission, with the GitHub repo link attached).
**State:** Planning is complete and the scaffold is created. **Nothing has been built.**

---

## 0. Rules for the next session (read first)

1. **Do not start building until the user explicitly says "build"** (or "go ahead" / "start WP-01").
   - When they say "read handoff": read this file, confirm the state in about 10 lines, and **wait**.
   - The user dislikes unrequested building or publishing. Earlier, an unrequested design artifact had to be deleted.
2. The canonical documents are `docs/GRIDPULSE_MASTER_STRATEGY.md` (v3) and `docs/GRIDPULSE_CONTRACTS_DRAFT.md`, including §6, the locked design. If code and the documents disagree, the documents win unless the user decides otherwise.
3. **Test-first** (the user's global rules). Write tests, see them fail, implement, see them pass. Run one ECC reviewer agent after each work package, and conventional commits.
4. **All product code is hand-written in-session.** Do not copy other teams' code: their public GridLock repos were read for challenge context only.
5. **CEII:** use only the unredacted fields of the GPC IRP public-disclosure PDF. Never infer redacted values.

## 1. What we're building (one paragraph)

GridPulse is for Sperry Tech's **GridLock** challenge.
- It compares **Dominion Energy SC (DESC)** and **Georgia Power (GPC)** public transmission plans.
- It flags overlaps **within 25 mi**, measured at **closest points**, with tiers:
  - **T1** touching, crossing or a shared facility;
  - **T2** < 1 mi;
  - **T3** < 5 mi;
  - **T4** ≤ 25 mi.
- Sperry's **center-to-center** method is shown alongside.
- Timeline (build-window overlap, plus the gap in days) is the secondary signal.
- **Required:** an interactive UI and a ranked list. **Bonus:** a cost/impact estimate.
- **Our differentiators:**
  - both distance methods plus shared-facility detection;
  - a plan-change view;
  - page and quote evidence for every field;
  - operator workflow (triage, brief, CSV in Sperry's format);
  - AI-verified resource tags (P1c).

## 2. Locations

| What | Path |
|---|---|
| **Repo scaffold (build here)** | `~/Desktop/gridpulse/` (not yet `git init`) |
| Planning folder (originals and research) | `~/Documents/ChatGPT/Shellhacks Sperry Tech/` |
| Sperry starter zip | `~/Downloads/Sperry-Tech-Challenge.zip` |
| Extra sources (gitignored) | `~/Desktop/gridpulse/data/raw/`: DESC 2025–29 and 2026–30, SERTP 2025 and 2026, with `SHA256SUMS.txt` |
| Archived v2 research (SERTP, Alabama) | `~/Documents/ChatGPT/Shellhacks Sperry Tech/research/` (reference only) |
| Design style reference | `~/Downloads/DESIGN.md` (Pravah), already distilled into contracts §6 |

**First build step:** unzip the starter package into `data/raw/starter/`.

It contains:
- `ShellHacks_Challenge_Gridlock.docx`;
- `Finding_Real_Locations_Guide.docx`;
- `Projects_Overlaps.xlsx` (the answer key);
- `Project Listings/Dominion Energy/2024-2028-2million-and-above-project-descriptions.pdf` (SHA prefix `890876d0faefd405`, identical to scrtp.com);
- `Project Listings/Georgia Power/2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf` (668 pp);
- `Opportunities/Software_Engineer_Intern_Listing.docx`.

## 3. Environment (verified)

- **Python 3.12.8** (official pyenv 2.6.22), pinned by `.python-version` and `backend/runtime.txt`.
- Node 22.22 / npm 10.9 (nvm). git, pytest 8.4, ruff 0.15 and pdftotext are present.
- **Not installed yet:** Shapely, PyMuPDF, FastAPI and similar (pip install at WP-01); `uv`, `gh`, `doctl` (not needed except for GitHub push, see below).
- **Plugins:**
  - `ecc@ecc` 2.2.2;
  - `context7` (use it for PydanticAI v2 / MapLibre v5 / FastAPI / Shapely docs);
  - `pyright-lsp` (pyright 1.1.414);
  - `typescript-lsp`;
  - `playwright`;
  - `github` (**needs `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment**; otherwise ask the user to run `! gh auth login` after installing gh).
- **Keys** the user must supply in `.env` for P1c only: `OPENROUTER_API_KEY` (with a spending limit), optionally `GOOGLE_API_KEY`.

## 4. Verified facts the build must reproduce

**Answer key (`Projects_Overlaps.xlsx`):** 10 projects, 6 overlaps. The haversine math was verified exactly (R = 3958.8 mi, center = midpoint of the two endpoints, or the single located point).

| Overlap | DESC | GPC | Center distance (mi) | Gap (days) |
|---|---|---|---|---|
| OVL_1 | DESC_2 Hooks–Thurmond 115 kV Tie | GPC_1 Evans Primary–Thurmond Dam #5 115 kV | 4.09 | 3074 |
| OVL_2 | DESC_3 Jasper–Okatie 230 kV #2 | GPC_2 SAV McIntosh–Purrysburg 230 kV reactors | 5.65 | 152 |
| OVL_3 | DESC_3 | GPC_3 SAV Goshen–McIntosh 115 kV rebuild | 7.55 | 517 |
| OVL_4 | DESC_1 Stevens Creek–Hooks | GPC_1 | 8.01 | 3074 |
| OVL_5 | DESC_5 Okatie–Bluffton 115 kV | GPC_2 | 14.34 | 365 |
| OVL_6 | DESC_5 | GPC_3 | 14.81 | 730 |

- **Not flagged (controls):** DESC_4 Queensboro–Ft Johnson (Charleston), GPC_4 Mitchell–North Tifton, GPC_5 Jesup–Ludowici.
- **Date quirks:** some dates are text ("12/31/2024") and some are Excel serial numbers (45809 = 2025-06-01, 45778 = 2025-05-01).
- **OVL_1 is actually T1 under closest points:** DESC_2's Thurmond endpoint and GPC_1's Thurmond Dam #5 endpoint are identical (33.660127, -82.195931).
- **Coordinate conflict:** McIntosh appears with two coordinates 0.41 mi apart (GPC_2 −81.175112 vs GPC_3 −81.182105). Hooks Sub has no coordinates.

**DESC lists:**
- One project per page: title, Project ID, Description, Need, Status (In Progress / Planned), Planned In-Service Date, and an Estimated Project Cost table (Previous, per-year columns, Total).
- Counts: **44** (2024–28), **47** (2025–29), **54** (2026–30).
- "**Okatie – McIntosh 115 kV Tie: Add Series Reactor**" (Deerfield switching station) appears in 2025–29 and is not in 2024–28.

**GPC 2025 IRP Vol 3:**
- **Table 2** "Georgia ITS 10 Year Plan Project List", **pp.177–191**, about **218 rows**. Columns: Zone, Year, TEAMS Number, Project Name (wraps over lines), Need Date, Project Sponsor, and cost columns (REDACTED).
  - Sponsors: GPC 129, GTC 57, SAV 16, MEAG 14, DU 2. **SAV = Georgia Power's Savannah zone.** GTC, MEAG and DU are other utilities, hidden by default.
- **Detail pages** (208), keyed by `Teams # NNNNN`. Fields: `Need Date`, `Start Date`, `Description`, `Change From Previous Ten Year Plan`, `Change From Previous IRP`. Supporting statement and costs are REDACTED.
  - Example: p.227, Teams #20277, McIntosh–Purrysburg reactors: Need 06/01/2026, Start 01/01/2024, "tie lines" (a DESC↔GPC tie), "New Project" vs the previous IRP.
- **Table 4** "Completed Projects – Removed" is on p.192.
- The pages carry a CEII banner (public-disclosure copy); see rule 5.

**Change-view facts:**
- GPC Goshen–McIntosh 115 kV: 6/1/2027 in the IRP and answer key, but **2028** in SERTP 2026 p.53 (it was 2027 in SERTP 2025 p.60).
- DESC 2024-28 → 2025-29 → 2026-30 counts: 44 → 47 → 54.

## 5. Build order (from master plan §8; re-base times from the actual start)

**M1 (about 4.5 h):**

1. **WP-01** `git init`, virtualenv (3.12.8), install deps, unzip the starter, FastAPI and Vite skeletons, `make dev`, first commit.
2. **WP-02** Parsers, **tests first**:
   - `parse_answer_key.py` → `tests/fixtures/answer_key.json`;
   - `parse_desc.py` (44 / 47 / 54 counts);
   - `parse_gpc.py` (Table 2 plus detail pages);
   - `parse_sertp.py`.
3. **WP-03** `locate.py`, in order:
   - Overpass (study box about lat 31.9–34.3, lon −83.2 to −80.6);
   - PDF-context confirmation;
   - answer-key coordinates;
   - HIFLD (archived) and EIA;
   - town centroid;
   - unresolved.
   Record decisions in `data/overrides/locations.csv`.
4. **WP-04** Engine: `geometry`, `distance` (closest-point with Shapely in EPSG:5070, plus center haversine), `tiers`, `timeline`, `rank`.
5. **Gate A:** `tests/test_acceptance.py` must pass:
   - 6/6 overlaps within ±0.01 mi, with matching gaps;
   - the 3 controls are not flagged;
   - OVL_1 is T1 under closest points.
   **Do not start the UI before this passes.**
6. **WP-05** API (read-only, `{data, error, meta}`); **WP-06** UI (ranked table, schematic map, detail panel, Centers ↔ Closest toggle).

**P1, in order:**
- **P1a:** cost estimator and brief;
- **P1b:** plan changes and "sources disagree" flags;
- **P1c:** AI (PydanticAI 2.51: `output_type=`, `retries={'tools':2,'output':2}`, `UsageLimits`, `TestModel`; OpenRouter `openrouter:<vendor>/<model>`, Gemini `google:<model>`);
- **P1d:**
  - DigitalOcean deploy (`ingress.rules`, uvicorn `--proxy-headers`);
  - triage status;
  - Data-quality view;
  - 2D layers (satellite, HIFLD backdrop, study area).

**Freeze** at T−3.5 h (07:30 EDT if on schedule). Then README (sources, CEII note, licenses incl. PyMuPDF AGPL, AI disclosure), screenshots, demo recording, Devpost.

**If behind:** cut P1c first, then P1b. **Always keep the cost bonus.**

## 6. Tech gotchas (verified this session)

- **PydanticAI v2:** `result_type`, `output_retries=`, `GeminiModel` and `google-gla:` are gone. The bare `openai:` prefix now means the Responses API. **Pin the exact version.**
- **MapLibre:** v6 is ESM-only and needs worker-URL config under Vite, so **pin `maplibre-gl@^5`**. Text labels need a glyphs URL, so use HTML labels to stay offline.
- **HIFLD Open** shut down 2025-08-26. The `services2.arcgis.com/FiaPA4ga0iQKduv3` layers are an **archived Esri federal mirror** (Esri license). Attribute them as archived.
- **Nominatim:** at most 1 request/s, a custom User-Agent, cache results, no browser autocomplete, ODbL attribution.
- **DigitalOcean App Platform:** `routes` is deprecated, so use `ingress.rules`. The default Python is 3.13, which `runtime.txt` pins to 3.12.8. The cheapest service is $5/month; static sites are free.
- **slowapi** behind a proxy needs uvicorn `--proxy-headers --forwarded-allow-ips='*'`.

## 7. Open items (contracts §7)

1. Confirm the study-area bounding box (Augusta, Thomson, Savannah, Beaufort).
2. Right-of-way width and mobilization-cost defaults: find a public source, or label them as team assumptions.
3. Choose the AI model with a quick comparison on 4 real DESC descriptions (WP-A1).
4. Keep DESC 2024–28 as the primary list (it matches the answer key); the newer lists feed the change view.

## 8. Design (locked; contracts §6)

- "Engineering dossier": parchment `#F3F1ED`, white surfaces, ink `#181011`, muted `#666666`, hairline `#D8D4D4`, one aubergine `#302023` strip.
- Color only for meaning: **DESC `#1A5FA8` as a circle**, **GPC `#9A4F00` as a square**, **overlap violet `#6E36B5`**. All are AA-verified. Shape plus label is mandatory, because the two utility colors have near-equal brightness.
- Tiers are encoded by line weight and dash, plus uppercase tracked badges.
- IBM Plex Sans, with Plex Mono for numbers. 4px radius, no shadows. A schematic 2D map.
- **Motion:** Centers ↔ Closest slide (300ms); respect reduced motion.
- **No 3D.**
