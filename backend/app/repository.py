"""Read-only access to data/processed/* (seed mode). Loaded once per process."""
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
PRECISION_ORDER = ["sperry_provided", "osm_feature", "endpoint_proxy", "regional_approximation", "unresolved"]


@dataclass(frozen=True)
class Repository:
    projects: dict[str, dict]
    opportunities: dict[str, list[dict]]
    quality: dict
    sources: list[dict]
    changes: list[dict]

    def project_ref(self, project_id: str) -> dict:
        p = self.projects[project_id]
        return {
            "id": p["id"], "utility": p["utility"], "name": p["name"], "source_id": p["source_id"],
            "page": p.get("detail_page") or p["page"], "in_service_date": p["in_service_date"],
            "window_start": p.get("window_start"), "window_end": p.get("window_end"),
            "precision": weakest_precision(p), "answer_key_id": p.get("answer_key_id"),
        }


def weakest_precision(project: dict) -> str:
    located = [e["precision"] for e in project.get("endpoints", []) if e.get("lat") is not None]
    if not located:
        return "unresolved"
    return max(located, key=PRECISION_ORDER.index)


def _json(name: str, default: object) -> object:
    path = PROCESSED / name
    return json.loads(path.read_text()) if path.exists() else default


@lru_cache(maxsize=1)
def get_repository() -> Repository:
    sources = yaml.safe_load((ROOT / "data" / "sources.yaml").read_text())["sources"]
    return Repository(
        projects={p["id"]: p for p in _json("projects.json", [])},
        opportunities=_json("opportunities.json", {"closest": [], "center": []}),
        quality=_json("quality.json", {}),
        sources=sources,
        changes=_json("changes.json", []),
    )
