"""GET /opportunities, /opportunities/{id}."""
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.brief import render_brief
from app.evidence import build_evidence
from app.repository import Repository, get_repository
from app.schemas import ok
from engine.estimate import default_inputs, estimate
from engine.rank import rank
from engine.timeline import WITHIN_ONE_YEAR_DAYS

router = APIRouter()

Method = Literal["closest", "center"]
Tier = Literal["T1", "T2", "T3", "T4"]
Timeline = Literal["same_window", "within_1y", "any"]
MIN_D, MAX_D, DEFAULT_D = 1.0, 50.0, 25.0


def within(opportunity: dict, d: float, method: str) -> bool:
    if method == "center":
        return opportunity["dist_center_mi"] <= d
    return opportunity["touching"] or opportunity["dist_closest_mi"] <= d


def enrich(repo: Repository, opportunity: dict) -> dict:
    return {**opportunity, "a": repo.project_ref(opportunity["a"]), "b": repo.project_ref(opportunity["b"]),
            "precision_a": repo.project_ref(opportunity["a"])["precision"],
            "precision_b": repo.project_ref(opportunity["b"])["precision"]}


def select(repo: Repository, d: float, method: str, tier: str | None = None, timeline: str = "any") -> list[dict]:
    items = [o for o in repo.opportunities[method] if within(o, d, method)]
    if tier:
        items = [o for o in items if o["tier"] == tier]
    if timeline == "same_window":
        items = [o for o in items if o["timeline_label"] == "same_window"]
    elif timeline == "within_1y":
        items = [o for o in items if o["in_service_gap_days"] <= WITHIN_ONE_YEAR_DAYS]
    return [enrich(repo, o) for o in rank(items)]


@router.get("/opportunities")
def opportunities(d: float = Query(DEFAULT_D, ge=MIN_D, le=MAX_D), tier: Tier | None = None,
                  timeline: Timeline = "any", method: Method = "closest") -> dict:
    items = select(get_repository(), d, method, tier, timeline)
    return ok(items, count=len(items), d=d, method=method)


def find(repo: Repository, opportunity_id: str, method: str = "closest") -> dict:
    found = next((o for o in repo.opportunities[method] if o["id"] == opportunity_id), None)
    if found is None:
        raise HTTPException(status_code=404, detail=f"unknown opportunity {opportunity_id}")
    return found


def _maps_link(project: dict) -> str | None:
    points = [(e["lat"], e["lon"]) for e in project["endpoints"] if e.get("lat") is not None]
    if not points:
        return None
    lat, lon = points[0]
    return f"https://www.google.com/maps/search/?api=1&query={quote(f'{lat},{lon}')}"


def detail(repo: Repository, opportunity_id: str, method: str = "closest") -> dict:
    opportunity = find(repo, opportunity_id, method)
    a, b = repo.projects[opportunity["a"]], repo.projects[opportunity["b"]]
    inputs = default_inputs(a, b, opportunity["dist_closest_mi"])
    return {
        **enrich(repo, opportunity),
        "project_a": a,
        "project_b": b,
        "evidence": build_evidence(opportunity, a, b),
        "estimator": {"inputs": inputs, "result": estimate(inputs)},
        "maps_links": {"a": _maps_link(a), "b": _maps_link(b)},
    }


@router.get("/opportunities/{opportunity_id}")
def opportunity(opportunity_id: str, method: Method = "closest") -> dict:
    return ok(detail(get_repository(), opportunity_id, method))


@router.get("/opportunities/{opportunity_id}/brief", response_class=HTMLResponse)
def brief(opportunity_id: str, method: Method = "closest",
          shared_corridor_mi: float | None = Query(None, ge=0, le=500),
          row_width_ft: float | None = Query(None, ge=0, le=1000),
          usd_per_acre: float | None = Query(None, ge=0),
          mobilization_usd: float | None = Query(None, ge=0),
          avoided_mobilizations: float | None = Query(None, ge=0, le=100)) -> HTMLResponse:
    """Printable brief; estimator values edited in the UI arrive as query parameters."""
    base = detail(get_repository(), opportunity_id, method)
    edits = {k: v for k, v in {"shared_corridor_mi": shared_corridor_mi, "row_width_ft": row_width_ft,
                               "usd_per_acre": usd_per_acre, "mobilization_usd": mobilization_usd,
                               "avoided_mobilizations": avoided_mobilizations}.items() if v is not None}
    inputs = {**base["estimator"]["inputs"], **edits}
    return HTMLResponse(render_brief({**base, "estimator": {"inputs": inputs, "result": estimate(inputs)}}))
