"""Deterministic ranking (contracts §2.5)."""
from engine.rank import rank


def opp(id_, tier, label, gap, dist):
    return {"id": id_, "tier": tier, "timeline_label": label, "in_service_gap_days": gap, "dist_closest_mi": dist}


def test_rank_orders_by_tier_timing_gap_distance_id():
    items = [
        opp("e", "T3", "within_1y", 100, 2.0),
        opp("d", "T3", "same_window", 900, 4.0),
        opp("c", "T1", "separate", 3000, 0.0),
        opp("b", "T3", "within_1y", 100, 1.0),
        opp("a", "T3", "within_1y", 100, 1.0),
    ]

    ranked = rank(items)

    assert [o["id"] for o in ranked] == ["c", "d", "a", "b", "e"]
    assert [o["rank"] for o in ranked] == [1, 2, 3, 4, 5]


def test_rank_does_not_mutate_input():
    items = [opp("a", "T2", "separate", 1, 0.5)]

    rank(items)

    assert "rank" not in items[0]
