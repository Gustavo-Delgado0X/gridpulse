"""Build step: answer-key links (labels and checks only), overrides, discrepancies (contracts §1.5 steps 4-6)."""
from pipeline.build import apply_overrides, independent_check, link_answer_key


def ep(name, lat=None, lon=None, precision="unresolved", id_=None):
    return {"id": id_ or f"ga:{name.lower()}", "name_raw": name, "lat": lat, "lon": lon, "precision": precision,
            "method": "test", "source": None, "confirmed_by_pdf_context": False, "alternatives": [], "reviewer": None}


PROJECT = {"id": "gpc-20065", "utility": "GPC", "state": "GA",
           "endpoints": [ep("GOSHEN", 32.2487, -81.2094, "osm_feature", "osm:way/3"),
                         ep("MCINTOSH", 32.3521162, -81.1751124, "osm_feature", "osm:way/4")]}
KEY = {"projects": [{"project_id": "GPC_3", "endpoints": [
    {"name": "GOSHEN", "lat": 32.248701, "lon": -81.209472},
    {"name": "MCINTOSH", "lat": 32.352116, "lon": -81.182105}]}]}
LINKS = {"GPC_3": "gpc-20065"}


def test_answer_key_labels_projects_but_never_supplies_coordinates():
    [project], _ = link_answer_key([PROJECT], KEY, LINKS)

    goshen, mcintosh = project["endpoints"]
    assert goshen == PROJECT["endpoints"][0] and mcintosh == PROJECT["endpoints"][1]  # our OSM locations, untouched
    assert project["answer_key_id"] == "GPC_3"
    assert "answer_key_id" not in PROJECT


def test_conflicting_osm_and_key_coordinates_are_reported_and_osm_is_kept():
    _, discrepancies = link_answer_key([PROJECT], KEY, LINKS)

    [conflict] = discrepancies
    assert conflict["kind"] == "coordinate_conflict"
    assert conflict["project_id"] == "gpc-20065" and conflict["endpoint"] == "MCINTOSH"
    assert 0.35 < conflict["miles_apart"] < 0.45
    assert conflict["message"].endswith("GridPulse uses OpenStreetMap")


def test_key_endpoint_unknown_to_parser_is_not_added():
    key = {"projects": [{"project_id": "GPC_3", "endpoints": [{"name": "WEST MCINTOSH", "lat": 32.35, "lon": -81.18}]}]}

    [project], _ = link_answer_key([PROJECT], key, LINKS)

    assert [e["name_raw"] for e in project["endpoints"]] == ["GOSHEN", "MCINTOSH"]


def test_independent_check_finds_key_pairs_in_our_own_opportunities():
    key = {"overlaps": [{"overlap_id": "OVL_1", "project_id_a": "DESC_2", "project_id_b": "GPC_1", "distance_mi": 4.09,
                         "time_gap_days": 3074},
                        {"overlap_id": "OVL_9", "project_id_a": "DESC_9", "project_id_b": "GPC_9", "distance_mi": 1.0,
                         "time_gap_days": 0}]}
    links = {"DESC_2": "desc-a", "GPC_1": "gpc-b", "DESC_9": "desc-x", "GPC_9": "gpc-y"}
    ours = {"closest": [{"a": "desc-a", "b": "gpc-b", "tier": "T1", "touching": True, "dist_closest_mi": 0.0,
                         "dist_center_mi": 4.1, "in_service_gap_days": 3074}],
            "center": [{"a": "desc-a", "b": "gpc-b", "tier": "T3", "touching": False, "dist_closest_mi": 0.0,
                        "dist_center_mi": 4.1, "in_service_gap_days": 3074}]}

    report = independent_check(key, links, ours)

    assert (report["found"], report["expected"]) == (1, 2)
    hit, miss = report["details"]
    assert hit == {"overlap_id": "OVL_1", "expected_mi": 4.09, "got_center_mi": 4.1, "tier": "T1", "touching": True,
                   "got_closest_mi": 0.0, "expected_gap": 3074, "got_gap": 3074, "found": True}
    assert miss["found"] is False and miss["got_center_mi"] is None


def test_overrides_fill_unresolved_endpoints():
    unresolved = {**PROJECT, "endpoints": [ep("PURRYSBURG")]}
    rows = [{"endpoint_id": "ga:purrysburg", "lat": "32.30", "lon": "-81.10", "precision": "regional_approximation",
             "method": "town centroid", "source": "Census", "confirmed_by_pdf_context": "false",
             "reviewer": "team", "notes": ""}]

    [project] = apply_overrides([unresolved], rows)

    [purrysburg] = project["endpoints"]
    assert (purrysburg["lat"], purrysburg["lon"]) == (32.30, -81.10)
    assert purrysburg["precision"] == "regional_approximation"
    assert purrysburg["reviewer"] == "team"
