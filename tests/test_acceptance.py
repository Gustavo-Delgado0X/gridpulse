"""Gate A (contracts §2.6): reproduce Sperry's answer key from its own 10 projects.

Must pass before any UI work. Runs on the committed fixture, so no raw PDFs are needed.
"""
import json

import pytest

from engine.opportunities import find_opportunities
from pipeline.parse_answer_key import to_engine_projects
from tests.conftest import FIXTURES

KEY = json.loads((FIXTURES / "answer_key.json").read_text())
PROJECTS = to_engine_projects(KEY)
EXPECTED = {(o["project_id_a"], o["project_id_b"]): o for o in KEY["overlaps"]}
CONTROLS = {"DESC_4", "GPC_4", "GPC_5"}


def pairs(opportunities):
    return {(o["a"], o["b"]): o for o in opportunities}


def test_center_method_finds_exactly_the_six_answer_key_overlaps():
    found = pairs(find_opportunities(PROJECTS, method="center"))

    assert set(found) == set(EXPECTED)


@pytest.mark.parametrize("key", sorted(EXPECTED), ids=lambda k: f"{k[0]}-{k[1]}")
def test_center_distance_and_gap_match_answer_key(key):
    found = pairs(find_opportunities(PROJECTS, method="center"))[key]
    expected = EXPECTED[key]

    assert found["dist_center_mi"] == pytest.approx(expected["distance_mi"], abs=0.01)
    assert found["in_service_gap_days"] == expected["time_gap_days"]


@pytest.mark.parametrize("method", ["center", "closest"])
def test_controls_are_never_flagged(method):
    found = find_opportunities(PROJECTS, method=method)

    flagged = {o["a"] for o in found} | {o["b"] for o in found}
    assert not flagged & CONTROLS


def test_closest_method_marks_thurmond_pair_as_touching_t1():
    found = pairs(find_opportunities(PROJECTS, method="closest"))[("DESC_2", "GPC_1")]

    assert found["touching"] is True
    assert found["tier"] == "T1"
    assert found["dist_closest_mi"] == pytest.approx(0.0, abs=1e-6)
    assert found["in_sperry_method"] is True


def test_closest_method_keeps_all_six_and_never_exceeds_center_distance():
    found = pairs(find_opportunities(PROJECTS, method="closest"))

    assert set(EXPECTED) <= set(found)
    for key in EXPECTED:
        assert found[key]["dist_closest_mi"] <= found[key]["dist_center_mi"] + 1e-9


def test_results_are_ranked_and_t1_first():
    ranked = find_opportunities(PROJECTS, method="closest")

    assert [o["rank"] for o in ranked] == list(range(1, len(ranked) + 1))
    assert ranked[0]["tier"] == "T1"
