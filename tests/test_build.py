"""Build step: answer-key coordinates, overrides, discrepancies (contracts §1.5 steps 4-6)."""
from pipeline.build import apply_answer_key, apply_overrides


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


def test_answer_key_coordinates_become_sperry_provided_without_mutating_input():
    [project], _ = apply_answer_key([PROJECT], KEY, LINKS)

    goshen, mcintosh = project["endpoints"]
    assert goshen["precision"] == "sperry_provided" and goshen["lat"] == 32.248701
    assert goshen["id"] == "osm:way/3"  # keeps the OSM identity for shared-facility checks
    assert PROJECT["endpoints"][0]["precision"] == "osm_feature"
    assert project["answer_key_id"] == "GPC_3"


def test_conflicting_osm_and_key_coordinates_are_reported():
    _, discrepancies = apply_answer_key([PROJECT], KEY, LINKS)

    [conflict] = discrepancies
    assert conflict["kind"] == "coordinate_conflict"
    assert conflict["project_id"] == "gpc-20065" and conflict["endpoint"] == "MCINTOSH"
    assert 0.35 < conflict["miles_apart"] < 0.45


def test_key_endpoint_unknown_to_parser_is_added():
    key = {"projects": [{"project_id": "GPC_3", "endpoints": [{"name": "WEST MCINTOSH", "lat": 32.35, "lon": -81.18}]}]}

    [project], _ = apply_answer_key([PROJECT], key, LINKS)

    assert [e["name_raw"] for e in project["endpoints"]][-1] == "WEST MCINTOSH"


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
