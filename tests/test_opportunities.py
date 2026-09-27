"""Opportunity finder details: ids, flags, threshold, draw points."""
from engine.opportunities import find_opportunities


def project(pid, utility, points, date="2026-06-01", window=(None, None), precision="sperry_provided"):
    return {
        "id": pid, "utility": utility, "name": pid,
        "endpoints": [{"id": f"{pid}:{i}", "name": str(i), "lat": p[0], "lon": p[1], "precision": precision}
                      for i, p in enumerate(points)],
        "line": None, "in_service_date": date, "window_start": window[0], "window_end": window[1],
    }


A = project("desc-1", "DESC", [(32.0, -81.0), (32.1, -81.0)])
B = project("gpc-1", "GPC", [(32.05, -81.2)], date="2026-12-01")
FAR = project("gpc-2", "GPC", [(34.5, -84.0)])


def test_threshold_is_adjustable():
    assert len(find_opportunities([A, B], max_miles=5)) == 0
    assert len(find_opportunities([A, B], max_miles=25)) == 1


def test_same_utility_pairs_are_ignored():
    other_desc = project("desc-2", "DESC", [(32.0, -81.01)])

    assert find_opportunities([A, other_desc]) == []


def test_opportunity_carries_draw_points_and_flags():
    [opp] = find_opportunities([A, B, FAR])

    assert opp["id"] == "desc-1__gpc-1"
    assert len(opp["closest_points"]) == 2 and len(opp["centers"]) == 2
    assert opp["in_service_gap_days"] == 183
    assert opp["timeline_label"] == "within_1y"
    assert opp["flags"] == []


def test_low_confidence_location_flag():
    regional = project("gpc-3", "GPC", [(32.05, -81.2)], precision="regional_approximation")

    [opp] = find_opportunities([A, regional])

    assert "low_confidence_location" in opp["flags"]


def test_method_disagree_flag_when_only_closest_is_within_threshold():
    long_line = project("desc-9", "DESC", [(32.0, -81.0), (33.5, -81.0)])
    near_start = project("gpc-9", "GPC", [(32.0, -81.1)])

    [opp] = find_opportunities([long_line, near_start])

    assert opp["in_sperry_method"] is False
    assert "method_disagree" in opp["flags"]


def test_unlocated_projects_are_skipped():
    ghost = {**B, "id": "gpc-x", "endpoints": [{"id": "x", "name": "x", "lat": None, "lon": None,
                                               "precision": "unresolved"}]}

    assert find_opportunities([A, ghost]) == []


def test_window_overlap_drives_same_window_label():
    a = project("desc-1", "DESC", [(32.0, -81.0)], window=("2025-01-01", "2026-06-01"))
    b = project("gpc-1", "GPC", [(32.0, -81.05)], date="2029-06-01", window=("2026-01-01", "2029-06-01"))

    [opp] = find_opportunities([a, b])

    assert opp["window_overlap_days"] == 151
    assert opp["timeline_label"] == "same_window"
