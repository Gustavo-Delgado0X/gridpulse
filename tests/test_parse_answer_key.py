"""Answer-key parser (contracts §2.6): Sperry's 10 projects and 6 overlaps."""
import datetime as dt
import json

import pytest

from pipeline.parse_answer_key import parse_date, parse_workbook
from tests.conftest import FIXTURES, STARTER, require

KEY_XLSX = STARTER / "Projects_Overlaps.xlsx"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("12/31/2024", dt.date(2024, 12, 31)),
        ("6/1/2033", dt.date(2033, 6, 1)),
        (45809, dt.date(2025, 6, 1)),
        (45778, dt.date(2025, 5, 1)),
        (45809.0, dt.date(2025, 6, 1)),
        (dt.datetime(2025, 6, 1), dt.date(2025, 6, 1)),
        (dt.date(2025, 5, 1), dt.date(2025, 5, 1)),
    ],
)
def test_parse_date_handles_text_serials_and_datetimes(raw, expected):
    assert parse_date(raw) == expected


def test_parse_date_rejects_garbage():
    with pytest.raises(ValueError):
        parse_date("soon")


def test_workbook_has_ten_projects_and_six_overlaps():
    key = parse_workbook(require(KEY_XLSX))

    assert len(key["projects"]) == 10
    assert [o["overlap_id"] for o in key["overlaps"]] == [f"OVL_{i}" for i in range(1, 7)]


def test_workbook_computes_centers_from_endpoints_not_formulas():
    projects = {p["project_id"]: p for p in parse_workbook(require(KEY_XLSX))["projects"]}

    # DESC_1 has only Stevens Creek located -> center is that point
    assert projects["DESC_1"]["center"] == [33.562599, -82.051362]
    # DESC_3 has both endpoints -> midpoint
    assert projects["DESC_3"]["center"] == pytest.approx([(32.35912 + 32.333758) / 2, (-81.1246 + -81.032495) / 2])
    assert projects["DESC_5"]["in_service_date"] == "2025-06-01"
    assert projects["GPC_4"]["in_service_date"] == "2025-05-01"


def test_workbook_endpoints_keep_missing_coordinates_as_none():
    projects = {p["project_id"]: p for p in parse_workbook(require(KEY_XLSX))["projects"]}

    hooks = projects["DESC_2"]["endpoints"][0]
    assert hooks["name"] == "Hooks Sub"
    assert hooks["lat"] is None and hooks["lon"] is None


def test_committed_fixture_matches_workbook():
    fixture = json.loads((FIXTURES / "answer_key.json").read_text())

    assert fixture == parse_workbook(require(KEY_XLSX))
