"""DESC list parser (contracts §1.2)."""
import pytest

from pipeline.parse_desc import (
    EXPECTED_COUNTS,
    build_window,
    endpoint_names,
    normalize_project_id,
    parse_cost_lines,
    parse_desc_date,
    parse_page,
    parse_pdf,
    stated_miles,
)
from tests.conftest import RAW, STARTER, require

PAGE = """Project 3 of 44
Dominion Energy South Carolina
Planned Transmission Projects $2M and above Total
5 Year Budget

Okatie 230-115kV Substation, Jasper – Yemassee 230kV #1 Fold-in

Project ID
0139 M,N

Project Description
Expand existing Okatie Transmission sub, add a 230-115 autobank and fold the Jasper – Yemassee 230
kV #1 line into the 230 kV side.

Project Need
This project is needed to improve system performance.

Project Status
In Progress

Planned In-Service Date
12/31/2024

Estimated Project Cost
Previous
2024
2025
2026
2027
2028
Total*
$2,717,933

$6,631,000

$1,181,000

$0
$0
$0
$11,116,933

*Total Estimated Amount applied to 2025 Rate Base Calculation
"""

DESC_2428 = STARTER / "Project Listings" / "Dominion Energy" / "2024-2028-2million-and-above-project-descriptions.pdf"


def test_parse_page_extracts_every_field_verbatim():
    project = parse_page(PAGE, page=3, source_id="desc-2428")

    assert project["name"] == "Okatie 230-115kV Substation, Jasper – Yemassee 230kV #1 Fold-in"
    assert project["project_id_raw"] == "0139 M,N"
    assert project["id"] == "desc-2428-139-m-n"
    assert project["description"].startswith("Expand existing Okatie")
    assert "230 kV #1 line" in project["description"]  # wrapped line re-joined with a space
    assert project["status"] == "In Progress"
    assert project["in_service_date"] == "2024-12-31"
    assert project["voltage_kv"] == 230
    assert project["utility"] == "DESC"
    assert project["page"] == 3


def test_parse_page_reads_cost_schedule_in_column_order():
    cost = parse_page(PAGE, page=3, source_id="desc-2428")["cost_public"]

    assert cost["previous_usd"] == 2_717_933
    assert cost["by_year"] == {"2024": 6_631_000, "2025": 1_181_000, "2026": 0, "2027": 0, "2028": 0}
    assert cost["total_usd"] == 11_116_933


def test_parse_page_records_evidence_quotes_with_page():
    evidence = parse_page(PAGE, page=3, source_id="desc-2428")["evidence"]
    fields = {e["field"] for e in evidence}

    assert {"name", "project_id", "description", "status", "in_service_date", "cost_total"} <= fields
    assert all(e["page"] == 3 and e["source_id"] == "desc-2428" for e in evidence)


def test_build_window_from_spend_years():
    started_before = {"previous_usd": 10, "by_year": {"2024": 5, "2025": 0}, "total_usd": 15}
    starts_later = {"previous_usd": 0, "by_year": {"2024": 0, "2025": 0, "2026": 7}, "total_usd": 7}

    assert build_window(started_before, "2024-12-31") == ("2024-01-01", "2024-12-31", True)
    assert build_window(starts_later, "2027-12-31") == ("2026-01-01", "2027-12-31", False)
    assert build_window(None, "2027-12-31") == (None, None, False)


@pytest.mark.parametrize(
    ("raw", "iso", "quirk"),
    [("12/31/23", "2023-12-31", None), ("12/31/2024", "2024-12-31", None),
     ("04/31/26", "2026-04-30", "invalid day 31 clamped to month end"),
     ("10/1/2025 (phase 1) and 10/1/2026 (phase 2)", "2026-10-01",
      "phased: 10/1/2025 (phase 1) and 10/1/2026 (phase 2); final phase used")],
)
def test_parse_desc_date(raw, iso, quirk):
    assert parse_desc_date(raw) == (iso, quirk)


def test_normalize_project_id_drops_leading_zeros_and_spacing():
    assert normalize_project_id("06810 H") == normalize_project_id("6810 H") == "6810-h"
    assert normalize_project_id("0167C-D") == "167c-d"


@pytest.mark.parametrize(
    ("title", "names"),
    [
        ("Hooks - Thurmond 115 kV Tie: Rebuild", ["Hooks", "Thurmond"]),
        ("Jasper - Okatie 230 kV #2: Construct", ["Jasper", "Okatie"]),
        ("Okatie-Bluffton 115 kV: Rebuild", ["Okatie", "Bluffton"]),
        ("Stevens Creek - Hooks 115 kV / LR Plumb Branch 46 kV Rebuilds", ["Stevens Creek", "Hooks"]),
        ("Union Pier 115-13.8 kV Sub: Tap", ["Union Pier"]),
        ("VCS2-Ward 230kV: Rebuild Line", ["VCS2", "Ward"]),
    ],
)
def test_endpoint_names_from_title(title, names):
    assert endpoint_names(title) == names


@pytest.mark.parametrize(("filename", "source_id"), [
    (None, "desc-2428"), ("desc_2025-2029.pdf", "desc-2529"), ("desc_2026-2030.pdf", "desc-2630")])
def test_real_lists_parse_to_expected_counts(filename, source_id):
    path = require(DESC_2428 if filename is None else RAW / filename)

    projects = parse_pdf(path, source_id)

    assert len(projects) == EXPECTED_COUNTS[source_id]
    assert all(p["in_service_date"] and p["name"] and p["cost_public"] for p in projects)


def test_real_2428_contains_answer_key_projects():
    by_id = {p["project_id_raw"]: p for p in parse_pdf(require(DESC_2428), "desc-2428")}

    assert by_id["6810 A"]["name"] == "Hooks - Thurmond 115kV Tie: Rebuild"
    assert by_id["6810 A"]["endpoint_names"] == ["Hooks", "Thurmond"]
    assert by_id["06367 D - G"]["endpoint_names"] == ["Jasper", "Okatie"]
    assert by_id["06076A"]["line_miles"] == 18


def test_prose_cost_is_kept_as_note_with_stated_total():
    cost = parse_cost_lines(["Estimated cost of $20,350,000 is to be financed by the interconnection customer."])

    assert cost["total_usd"] == 20_350_000
    assert cost["by_year"] == {}
    assert cost["note"].startswith("Estimated cost of $20,350,000")


@pytest.mark.parametrize(("text", "miles"), [
    ("Canadys-Ritter 115KV-Rebld SPDC 230/115KV 1272 (Approx 18 Miles)", 18.0),
    ("Rebuild 40 miles of 230 kV line.", 40.0),
    ("Harleyville 115KV Transmission Tap – Construct (1.4 miles)", 1.4),
    ("Rebuild the line.", None),
])
def test_line_miles_only_when_stated(text, miles):
    assert stated_miles(text) == miles


def test_reused_project_id_gets_page_suffix_and_flag():
    projects = parse_pdf(require(RAW / "desc_2026-2030.pdf"), "desc-2630")
    reused = [p for p in projects if p["project_id_raw"].replace(" ", "") == "6809M"]

    assert len({p["id"] for p in projects}) == len(projects)
    assert [p["id"] for p in reused] == ["desc-2630-6809-m", "desc-2630-6809-m-p48"]
    assert reused[1]["id_quirk"] == "Project ID 6809 M also used on p.19"
