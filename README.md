# GridPulse

Cross-utility planning intelligence for Sperry Tech's **GridLock** challenge (ShellHacks 2026).
GridPulse compares Dominion Energy South Carolina (DESC) and Georgia Power (GPC) public transmission
plans, ranks where their planned work overlaps (within 25 mi, closest points, tiers T1–T4, timeline as
secondary signal), cites every fact to its source page, and shows what changed between plan versions.

> **Status:** scaffold only — awaiting review. No implementation yet.

## Docs
- `docs/GRIDPULSE_MASTER_STRATEGY.md` — plan (v3)
- `docs/GRIDPULSE_CONTRACTS_DRAFT.md` — data / engine / API / AI / design contracts

## Layout
| Folder | Purpose |
|---|---|
| `pipeline/` | Offline, deterministic data build (fetch → parse → locate → build) |
| `engine/` | Pure functions: geometry, distances, tiers, timeline, ranking, changes, estimate |
| `ai/` | P1c — embedded PydanticAI agents (bounded, verified, cached) |
| `backend/` | FastAPI read-only API over `data/processed/` |
| `frontend/` | React + TypeScript + Vite + MapLibre v5 operator console |
| `data/` | Sources registry, overrides, caches, processed outputs (raw PDFs gitignored) |
| `tests/` | pytest incl. Gate A acceptance test against Sperry's answer key |

## Setup / Run
_TBD at build time_ (`make dev`, `make test`, `make pipeline`, `make acceptance`).

## Data sources & attribution
_TBD_: SCRTP (DESC lists), Georgia PSC filing (GPC 2025 IRP Vol 3 Public Disclosure — unredacted fields only; CEII note),
SERTP, OpenStreetMap (© OpenStreetMap contributors, ODbL), HIFLD (archived Aug 2025, Esri federal mirror), EIA, U.S. Census.

## Disclosures
_TBD_: third-party libraries and licenses (PyMuPDF AGPL-3.0), AI assistance, team owners per work package.
