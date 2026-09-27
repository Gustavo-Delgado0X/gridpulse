"""Location matching (contracts §1.5): OSM name match, state/zone confirmation, fallbacks, precision."""
import pytest

from pipeline.locate import OsmIndex, core_name, locate_endpoint, name_variants


def feature(osm_id, name, lat, lon, operator=None):
    tags = {"power": "substation", "name": name}
    if operator:
        tags["operator"] = operator
    return {"type": "way", "id": osm_id, "center": {"lat": lat, "lon": lon}, "tags": tags}


OSM = {
    "GA": [
        feature(1, "Thurmond Substation", 33.6601273, -82.1959307, "Georgia Power"),
        feature(2, "Goshen Substation", 33.3197599, -81.9953118, "Georgia Power"),
        feature(3, "Goshen Substation", 32.2487012, -81.2094724, "Georgia Power"),
        feature(4, "McIntosh Substation", 32.3521162, -81.1751124, "Georgia Power"),
        feature(5, "Evans Primary Substation", 33.5439942, -82.1686481, "Georgia Power"),
    ],
    "SC": [
        feature(10, "Jasper Substation", 32.3606993, -81.1241523),
        feature(11, "Okatie Substation", 32.333758, -81.032495),
    ],
}
INDEX = OsmIndex(OSM)


@pytest.mark.parametrize(
    ("raw", "core"),
    [("Evans Primary Substation", "evans primary"), ("THURMOND DAM #5", "thurmond dam #5"),
     ("WADLEY PRI.", "wadley primary"), ("MELDRIM BANK D REPLACEMENT", "meldrim"),
     ("Edenwood Sub", "edenwood"), ("GOAT ROCK REACTORS INSTALLATION", "goat rock")],
)
def test_core_name(raw, core):
    assert core_name(raw) == core


def test_name_variants_relax_unit_numbers_and_dam():
    assert name_variants("THURMOND DAM #5") == ["thurmond dam #5", "thurmond dam", "thurmond"]


def test_unique_name_match_is_located_but_not_claimed_as_confirmed():
    ep = locate_endpoint("Jasper", state="SC", zone=None, title="Jasper - Okatie 230 kV #2: Construct", index=INDEX)

    assert ep["id"] == "osm:way/10"
    assert ep["precision"] == "osm_feature"
    assert ep["confirmed_by_pdf_context"] is False  # a unique name is not PDF context
    assert "unique OSM name" in ep["method"]
    assert (ep["lat"], ep["lon"]) == (32.3606993, -81.1241523)


def test_zone_disambiguates_duplicate_names():
    savannah = locate_endpoint("GOSHEN", state="GA", zone="219", title="SAV: GOSHEN (SAV) - MCINTOSH", index=INDEX)
    augusta = locate_endpoint("GOSHEN", state="GA", zone="215", title="GOSHEN - VOGTLE", index=INDEX)

    assert savannah["id"] == "osm:way/3" and savannah["confirmed_by_pdf_context"] is True
    assert augusta["id"] == "osm:way/2"


def test_tie_line_endpoint_falls_back_to_neighbor_state():
    ep = locate_endpoint("Thurmond", state="SC", zone=None, title="Hooks - Thurmond 115kV Tie: Rebuild", index=INDEX)

    assert ep["id"] == "osm:way/1"
    assert ep["confirmed_by_pdf_context"] is True
    assert "neighboring state" in ep["method"]


def test_gpc_dam_unit_matches_substation_by_relaxed_variant():
    ep = locate_endpoint("THURMOND DAM #5", state="GA", zone="215", title="EVANS PRIMARY - THURMOND DAM (USA) #5",
                         index=INDEX)

    assert ep["id"] == "osm:way/1"
    assert "relaxed" in ep["method"]


def test_unmatched_name_is_unresolved():
    ep = locate_endpoint("Hooks", state="SC", zone=None, title="Hooks - Thurmond 115kV Tie", index=INDEX)

    assert ep["precision"] == "unresolved"
    assert ep["lat"] is None and ep["id"] == "sc:hooks"


def test_ambiguous_match_is_left_unresolved_not_guessed():
    ep = locate_endpoint("GOSHEN", state="GA", zone=None, title="GOSHEN - X", index=INDEX)

    assert ep["precision"] == "unresolved"
    assert ep["lat"] is None
    assert "2 OSM features share this name" in ep["method"]


ALIASES = OsmIndex({
    "GA": [
        feature(20, "Mitchell Substation (115kV)", 31.4439, -84.1351, "Georgia Power"),
        feature(21, "Mitchell Substation (230kV)", 31.447121, -84.133843, "Georgia Power"),
        feature(22, "Stevens Creek Dam Substation", 33.5616, -82.0533),
        feature(23, "Summerville Substation", 34.4719, -85.3375),
    ],
    "SC": [feature(30, "Queensborough Substation", 32.7228, -79.9673),
           feature(31, "Saint George Switching Station", 33.1994, -80.592)],
})


def test_osm_aliases_saint_borough_and_dam():
    queensboro = locate_endpoint("Queensboro", "SC", None, "Queensboro - Ft Johnson 115 kV", ALIASES)
    st_george = locate_endpoint("St George", "SC", None, "St George - Sumter 230kV Tie", ALIASES)

    assert queensboro["id"] == "osm:way/30"
    assert st_george["id"] == "osm:way/31"


def test_project_voltage_breaks_ties_between_same_named_features():
    ep = locate_endpoint("MITCHELL", "GA", "216", "MITCHELL - NORTH TIFTON 230KV RECONDUCTOR", ALIASES, voltage_kv=230)

    assert ep["id"] == "osm:way/21"
    assert ep["confirmed_by_pdf_context"] is True


def test_neighbor_state_needs_tie_or_zone_evidence():
    no_tie = locate_endpoint("Summerville", "SC", None, "Summerville 115kV Loop: Rebuild", ALIASES)
    border_plant = locate_endpoint("Stevens Creek", "SC", None, "Stevens Creek - Hooks 115kV/LR Plumb Branch 46kV",
                                   ALIASES)

    assert no_tie["precision"] == "unresolved"
    assert border_plant["precision"] == "unresolved"  # not a tie line: needs the answer key or an override
