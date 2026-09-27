"""Pairwise opportunity finder: gate, tier, both distances, timing, flags, rank (contracts §2.2-2.5).

Engine project shape:
  {id, utility, name, endpoints: [{id, name, lat, lon, precision}], line: [[lat, lon], ...] | None,
   in_service_date: "YYYY-MM-DD", window_start, window_end, flags?: [str]}
"""
import datetime as dt
from itertools import combinations

from engine.distance import closest, haversine_mi, shared_facility
from engine.geometry import LatLon, build_geometry, center_point
from engine.rank import rank
from engine.tiers import DEFAULT_MAX_MILES, passes_gate, tier_for
from engine.timeline import gap_days, timing_label, window_overlap_days

LOW_CONFIDENCE = {"endpoint_proxy", "regional_approximation"}
METHODS = ("closest", "center")


def _date(value: str | None) -> dt.date | None:
    return dt.date.fromisoformat(value) if value else None


def _points(project: dict) -> list[LatLon]:
    return [(e["lat"], e["lon"]) for e in project["endpoints"] if e.get("lat") is not None and e.get("lon") is not None]


def _prepared(project: dict) -> dict | None:
    points = _points(project)
    line = [tuple(p) for p in project["line"]] if project.get("line") else None
    geometry = build_geometry(points, line)
    if geometry is None:
        return None
    return {"project": project, "geometry": geometry, "center": center_point(points or list(line or []))}


def _flags(a: dict, b: dict, in_sperry: bool, closest_within: bool) -> list[str]:
    flags = []
    precisions = {e.get("precision") for p in (a, b) for e in p["endpoints"] if e.get("lat") is not None}
    if precisions & LOW_CONFIDENCE:
        flags.append("low_confidence_location")
    if in_sperry != closest_within:
        flags.append("method_disagree")
    if "sources_disagree" in a.get("flags", []) or "sources_disagree" in b.get("flags", []):
        flags.append("sources_disagree")
    return flags


def _evaluate(pa: dict, pb: dict, max_miles: float, method: str) -> dict | None:
    a, b = pa["project"], pb["project"]
    if a["utility"] == b["utility"]:
        return None
    near = closest(pa["geometry"], pb["geometry"])
    touching = near.miles == 0 or shared_facility(a["endpoints"], b["endpoints"])
    dist_closest = 0.0 if touching else near.miles
    dist_center = haversine_mi(pa["center"], pb["center"])
    in_sperry = dist_center < max_miles

    gate_touching, gate_miles = (touching, dist_closest) if method == "closest" else (False, dist_center)
    if not passes_gate(a["utility"], b["utility"], gate_touching, gate_miles, max_miles):
        return None

    gap = gap_days(_date(a["in_service_date"]), _date(b["in_service_date"]))
    overlap = window_overlap_days((_date(a.get("window_start")), _date(a.get("window_end"))),
                                  (_date(b.get("window_start")), _date(b.get("window_end"))))
    return {
        "id": f"{a['id']}__{b['id']}",
        "a": a["id"],
        "b": b["id"],
        "method": method,
        "tier": tier_for(gate_touching, gate_miles, max_miles),
        "touching": touching,
        "dist_closest_mi": round(dist_closest, 3),
        "dist_center_mi": round(dist_center, 3),
        "in_sperry_method": in_sperry,
        "closest_points": [list(near.point_a), list(near.point_b)],
        "centers": [list(pa["center"]), list(pb["center"])],
        "window_overlap_days": overlap,
        "in_service_gap_days": gap,
        "timeline_label": timing_label(overlap, gap),
        "flags": _flags(a, b, in_sperry, touching or dist_closest <= max_miles),
    }


def _ordered(pa: dict, pb: dict) -> tuple[dict, dict]:
    """DESC always on side a so ids and exports read DESC -> GPC like Sperry's key."""
    return (pb, pa) if pb["project"]["utility"] == "DESC" and pa["project"]["utility"] != "DESC" else (pa, pb)


def find_opportunities(projects: list[dict], max_miles: float = DEFAULT_MAX_MILES,
                       method: str = "closest") -> list[dict]:
    if method not in METHODS:
        raise ValueError(f"method must be one of {METHODS}")
    prepared = [p for p in map(_prepared, projects) if p is not None]
    found = (_evaluate(*_ordered(pa, pb), max_miles, method) for pa, pb in combinations(prepared, 2))
    return rank([o for o in found if o is not None])
