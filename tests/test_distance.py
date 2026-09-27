"""Distances (contracts §2.1-2.2): Sperry haversine centers + geodesic closest points."""
import pytest

from engine.distance import closest, haversine_mi, shared_facility
from engine.geometry import build_geometry, center_point

THURMOND = (33.660127, -82.195931)
EVANS = (33.543994, -82.168648)
STEVENS_CREEK = (33.562599, -82.051362)


def test_haversine_uses_sperry_earth_radius():
    # OVL_4 in the answer key: DESC_1 center (Stevens Creek) vs GPC_1 center
    gpc1_center = center_point([EVANS, THURMOND])

    assert round(haversine_mi(STEVENS_CREEK, gpc1_center), 2) == 8.01


def test_haversine_zero_for_same_point():
    assert haversine_mi(THURMOND, THURMOND) == 0.0


def test_center_point_is_midpoint_or_single_point():
    assert center_point([EVANS, THURMOND]) == pytest.approx(((33.543994 + 33.660127) / 2, (-82.168648 + -82.195931) / 2))
    assert center_point([STEVENS_CREEK]) == STEVENS_CREEK
    assert center_point([]) is None


def test_build_geometry_prefers_line_then_segment_then_point():
    line = build_geometry([EVANS, THURMOND], line=[EVANS, (33.6, -82.2), THURMOND])
    segment = build_geometry([EVANS, THURMOND])
    point = build_geometry([STEVENS_CREEK])

    assert line.geom_type == "LineString" and len(line.coords) == 3
    assert segment.geom_type == "LineString" and len(segment.coords) == 2
    assert point.geom_type == "Point"
    assert build_geometry([]) is None


def test_closest_is_zero_when_segments_share_an_endpoint():
    # DESC_2 is Hooks(unlocated)-Thurmond -> a point at Thurmond; GPC_1 ends at Thurmond Dam #5
    desc2 = build_geometry([THURMOND])
    gpc1 = build_geometry([EVANS, THURMOND])

    result = closest(desc2, gpc1)

    assert result.miles == pytest.approx(0.0, abs=1e-6)
    assert result.point_a == pytest.approx(THURMOND)


def test_closest_is_geodesic_and_not_more_than_center_distance():
    desc1 = build_geometry([STEVENS_CREEK])
    gpc1 = build_geometry([EVANS, THURMOND])

    result = closest(desc1, gpc1)

    assert 0 < result.miles < 8.01
    # nearest point on GPC_1 lies on its segment, between the two endpoints
    assert EVANS[0] <= result.point_b[0] <= THURMOND[0]


def test_closest_matches_haversine_for_two_points_within_half_percent():
    result = closest(build_geometry([STEVENS_CREEK]), build_geometry([EVANS]))

    assert result.miles == pytest.approx(haversine_mi(STEVENS_CREEK, EVANS), rel=0.005)


def test_shared_facility_by_endpoint_id_or_within_tolerance():
    a = [{"id": "ga:thurmond-dam", "lat": 33.660127, "lon": -82.195931}]
    b_same_id = [{"id": "ga:thurmond-dam", "lat": None, "lon": None}]
    b_near = [{"id": "sc:thurmond", "lat": 33.6605, "lon": -82.1960}]
    b_far = [{"id": "ga:evans", "lat": 33.543994, "lon": -82.168648}]

    assert shared_facility(a, b_same_id)
    assert shared_facility(a, b_near)
    assert not shared_facility(a, b_far)
