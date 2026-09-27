"""Gate B: the committed processed dataset (built from the real PDFs) still reproduces the answer key."""
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


@pytest.mark.parametrize("overlap", KEY["overlaps"], ids=lambda o: o["overlap_id"])
def test_real_data_contains_every_answer_key_overlap(opportunities, overlap):
    pair = (LINKS[overlap["project_id_a"]], LINKS[overlap["project_id_b"]])
    found = {(o["a"], o["b"]): o for o in opportunities["center"]}[pair]

    assert found["dist_center_mi"] == pytest.approx(overlap["distance_mi"], abs=0.01)
    assert found["in_service_gap_days"] == overlap["time_gap_days"]


def test_real_data_thurmond_pair_is_touching(opportunities):
    pair = f"{LINKS['DESC_2']}__{LINKS['GPC_1']}"
    found = next(o for o in opportunities["closest"] if o["id"] == pair)

    assert found["tier"] == "T1" and found["rank"] <= 2


def test_quality_report_records_passing_acceptance():
    quality = json.loads((PROCESSED / "quality.json").read_text())

    assert quality["acceptance"]["passed"] is True
    assert quality["acceptance"]["matched"] == 6


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
