"""Gate B: the committed dataset (built from the real PDFs and OSM only) finds every answer-key pair on its own."""
import csv
import json

import pytest

from tests.conftest import FIXTURES, ROOT

PROCESSED = ROOT / "data" / "processed"
KEY = json.loads((FIXTURES / "answer_key.json").read_text())
LINKS = {r["key_project_id"]: r["project_id"]
         for r in csv.DictReader((ROOT / "data" / "overrides" / "answer_key_links.csv").open())}


@pytest.fixture(scope="module")
def opportunities():
    return json.loads((PROCESSED / "opportunities.json").read_text())


@pytest.fixture(scope="module")
def projects():
    return json.loads((PROCESSED / "projects.json").read_text())


def test_no_location_comes_from_the_answer_key(projects):
    """Sperry's coordinates are for checking only: every drawn endpoint must come from OSM or a reviewed override."""
    from_key = [(p["id"], e["name_raw"]) for p in projects for e in p.get("endpoints", [])
                if e["precision"] == "sperry_provided" or e.get("source") == "Projects_Overlaps.xlsx"]

    assert from_key == []


@pytest.mark.parametrize("overlap", KEY["overlaps"], ids=lambda o: o["overlap_id"])
def test_our_own_locations_find_every_answer_key_overlap(opportunities, overlap):
    pair = (LINKS[overlap["project_id_a"]], LINKS[overlap["project_id_b"]])
    found = {(o["a"], o["b"]): o for o in opportunities["closest"]}[pair]

    assert found["tier"] is not None  # within 25 mi at closest points
    assert found["in_service_gap_days"] == overlap["time_gap_days"]  # dates come from the PDFs: exact


def test_real_data_thurmond_pair_is_touching(opportunities):
    pair = f"{LINKS['DESC_2']}__{LINKS['GPC_1']}"
    found = next(o for o in opportunities["closest"] if o["id"] == pair)

    assert found["tier"] == "T1" and found["rank"] <= 2


def test_quality_report_separates_distance_math_from_independent_locating():
    quality = json.loads((PROCESSED / "quality.json").read_text())

    assert quality["acceptance"]["passed"] is True and quality["acceptance"]["matched"] == 6
    assert (quality["independent"]["found"], quality["independent"]["expected"]) == (6, 6)


def test_processed_data_never_contains_redacted_text():
    for path in PROCESSED.glob("*.json"):
        assert "REDACTED" not in path.read_text(), path.name


@pytest.fixture(scope="module")
def changes():
    return json.loads((PROCESSED / "changes.json").read_text())


def test_goshen_mcintosh_irp_vs_sertp_disagreement_is_recorded(changes, opportunities):
    event = next(c for c in changes if c["project_id"] == LINKS["GPC_3"] and c["event"] == "sources_disagree")
    pair = next(o for o in opportunities["closest"] if o["id"] == f"{LINKS['DESC_3']}__{LINKS['GPC_3']}")

    assert (event["before"], event["after"]) == ("IRP 2027", "SERTP 2026: 2028")
    assert "sources_disagree" in pair["flags"]


def test_new_desc_tie_into_mcintosh_appears_in_2025_list(changes):
    new = [c for c in changes if c["event"] == "new" and "Okatie – McIntosh" in c["name"]]

    assert new and new[0]["evidence"][0]["source_id"] == "desc-2529"


def test_gpc_cancelled_and_completed_tables_feed_changes(changes):
    kinds = {c["event"] for c in changes}

    assert {"cancelled", "completed", "slipped", "new"} <= kinds


def test_parser_anomalies_are_reported_as_quality_issues():
    quality = json.loads((PROCESSED / "quality.json").read_text())
    kinds = {d["kind"] for d in quality["discrepancies"]}

    assert {"cost_table_mismatch", "date_normalized", "id_reused"} <= kinds
    riverport = [d for d in quality["discrepancies"] if d["kind"] == "cost_table_mismatch" and "Riverport" in d["message"]]
    assert riverport and "columns sum to" in riverport[0]["message"]


def test_no_false_sertp_or_id_reuse_changes(changes):
    echeconnee = [c for c in changes if c["event"] == "sources_disagree" and "ECHECONNEE" in c["name"] and "WELLSTON" in c["name"]]
    # 6809 G is Stevens Creek-Hooks in 2024-28 but Hooks-Modoc later: later changes must not link to the 2024-28 project
    linked_to_old = [c for c in changes if c["project_id"].endswith("6809-g") and c["primary_id"] == "desc-2428-6809-g"]

    assert echeconnee == [] and linked_to_old == []
    assert any(c["event"] == "id_reused" and c["project_id"] == "desc-2529-6809-g" for c in changes)


def test_desc_changes_link_to_ranked_opportunities(changes, opportunities):
    ranked = {x for o in opportunities["closest"] for x in (o["a"], o["b"])}
    jasper = [c for c in changes if c["event"] == "slipped" and "Jasper – Okatie 230 kV #2" in c["name"]]

    assert jasper and all(c["primary_id"] == "desc-2428-6367-d-g" for c in jasper)
    assert "desc-2428-6367-d-g" in ranked


def test_no_ambiguous_endpoint_is_drawn():
    projects = json.loads((PROCESSED / "projects.json").read_text())
    drawn_ambiguous = [e for p in projects for e in p.get("endpoints", []) if e["precision"] == "osm_feature"
                       and not e["confirmed_by_pdf_context"] and e.get("alternatives")
                       and any(a["id"] != e["id"] and abs(a["lat"] - e["lat"]) > 0.01 for a in e["alternatives"])]

    assert drawn_ambiguous == []
