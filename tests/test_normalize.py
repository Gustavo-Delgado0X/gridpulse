"""Endpoint-name extraction shared by DESC and GPC titles."""
import pytest

from pipeline.normalize import endpoint_id, endpoint_names, facility_name


@pytest.mark.parametrize(
    ("title", "names"),
    [
        ("SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD", ["GOSHEN", "MCINTOSH"]),
        ("EVANS PRIMARY - THURMOND DAM (USA) #5 115KV REBUILD", ["EVANS PRIMARY", "THURMOND DAM #5"]),
        ("SAV: MCINTOSH - PURRYSBURG 230KV REACTORS", ["MCINTOSH", "PURRYSBURG"]),
        ("GTC: BONAIRE PRI-ECHECONNEE 115 KV PARTIAL REBUILD", ["BONAIRE PRI", "ECHECONNEE"]),
        ("Queensboro - Ft Johnson 115 kV & Queensboro-Bayfront 115kV (Queensboro-James Island Sect)",
         ["Queensboro", "Ft Johnson"]),
        ("KRAFT 230/115KV TRANSFORMER RATING INCREASE", ["KRAFT"]),
    ],
)
def test_endpoint_names(title, names):
    assert endpoint_names(title) == names


def test_facility_name_and_id_are_state_scoped():
    assert facility_name("Hooks Sub") == "Hooks"
    assert endpoint_id("GA", "SAV: MCINTOSH") == "ga:mcintosh"
    assert endpoint_id("SC", "Okatie Sub") == "sc:okatie"
