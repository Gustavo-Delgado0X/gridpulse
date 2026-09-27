"""Deterministic ranking (contracts §2.5): tier, timing, gap days, closest distance, id."""
from engine.timeline import TIMING_ORDER

TIER_ORDER = {"T1": 1, "T2": 2, "T3": 3, "T4": 4}


def _key(opportunity: dict) -> tuple:
    distance = opportunity.get("dist_closest_mi")
    return (
        TIER_ORDER.get(opportunity["tier"], 9),
        TIMING_ORDER.get(opportunity["timeline_label"], 9),
        opportunity["in_service_gap_days"],
        distance if distance is not None else float("inf"),
        opportunity["id"],
    )


def rank(opportunities: list[dict]) -> list[dict]:
    ordered = sorted(opportunities, key=_key)
    return [{**o, "rank": i} for i, o in enumerate(ordered, start=1)]
