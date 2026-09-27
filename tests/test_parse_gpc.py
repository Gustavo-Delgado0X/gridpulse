"""GPC 2025 IRP Vol 3 parser (contracts §1.3). Redacted fields are never stored."""
import json

import pytest

from pipeline.parse_gpc import TABLE_ROW_KINDS, parse_detail_blocks, parse_irp, parse_table_lines
from tests.conftest import STARTER, require

IRP = STARTER / "Project Listings" / "Georgia Power" / "2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf"

TABLE_LINES = """Totals
219
2025
19523
SAV: CC - HYUNDAI MOTORS
SAVANNAH AKA. PROJECT EA
1/1/2025
SAV
REDACTED
REDACTED
216
2025
18492
MITCHELL - NORTH TIFTON
230KV RECONDUCTOR
5/1/2025
GPC
REDACTED
PUBLIC DISCLOSURE""".splitlines()


def test_table_lines_parse_wrapped_names_and_sponsors():
    rows = parse_table_lines(TABLE_LINES, kind="plan", page=177)

    assert [r["teams"] for r in rows] == ["19523", "18492"]
    assert rows[0]["name"] == "SAV: CC - HYUNDAI MOTORS SAVANNAH AKA. PROJECT EA"
    assert rows[0]["sponsor"] == "SAV" and rows[0]["zone"] == "219" and rows[0]["year"] == "2025"
    assert rows[1]["need_date"] == "2025-05-01"
    assert all(r["page"] == 177 for r in rows)
    assert "REDACTED" not in json.dumps(rows)


def test_table_row_kinds_cover_plan_cancelled_completed():
    assert set(TABLE_ROW_KINDS) == {"plan", "cancelled", "completed"}


BLOCKS = [
    (192, 87, 423, 98, "SAV: MCINTOSH - PURRYSBURG 230KV REACTORS \n"),
    (272, 109, 343, 120, "Teams # 20277 \n"),
    (202, 132, 413, 143, "Need Date 06/01/2026 Start Date 01/01/2024 \n"),
    (36, 154, 91, 165, "Description \n"),
    (36, 230, 139, 241, "Supporting Statement \n"),
    (36, 296, 205, 307, "Change From Previous Ten Year Plan \n"),
    (36, 358, 158, 369, "Change From Previous IRP \n"),
    (41, 419, 321, 432, "Estimated Cost – GPC   \nREDACTED \n"),
    (44, 182, 491, 206, "Install reactors on the McIntosh - Purrysburg (Black and White) 230kV tie lines at "
                        "McIntosh. Rebuild \n0.1 miles (GPC portion) for both lines.\n"),
    (239, 255, 303, 268, "REDACTED \n"),
    (44, 323, 96, 334, "No Change \n"),
    (44, 386, 102, 397, "New Project \n"),
]


def test_detail_blocks_map_values_to_labels_by_position():
    detail = parse_detail_blocks(BLOCKS, page=227)

    assert detail["teams"] == "20277"
    assert detail["title"] == "SAV: MCINTOSH - PURRYSBURG 230KV REACTORS"
    assert detail["need_date"] == "2026-06-01" and detail["start_date"] == "2024-01-01"
    assert detail["description"].startswith("Install reactors on the McIntosh - Purrysburg")
    assert "Rebuild 0.1 miles" in detail["description"]
    assert detail["change_vs_prev_ten_year"] == "No Change"
    assert detail["change_vs_prev_irp"] == "New Project"
    assert "REDACTED" not in json.dumps(detail)
    assert "supporting" not in json.dumps(detail).lower()


@pytest.fixture(scope="module")
def irp():
    return parse_irp(require(IRP))


def test_real_table2_counts_by_sponsor(irp):
    plan = irp["plan_rows"]
    sponsors = {}
    for r in plan:
        sponsors[r["sponsor"]] = sponsors.get(r["sponsor"], 0) + 1

    # 208 plan rows (one per detail page). The planning estimate of 218 also counted Table 3's
    # 10 cancelled rows (7 GPC + 3 GTC).
    assert len(plan) == 208
    assert sponsors == {"GPC": 122, "GTC": 54, "SAV": 16, "MEAG": 14, "DU": 2}


def test_real_detail_pages_are_keyed_by_teams(irp):
    assert len(irp["details"]) == 208
    reactors = irp["details"]["20277"]
    assert reactors["page"] == 227
    assert reactors["start_date"] == "2024-01-01"


def test_real_projects_merge_table_and_detail(irp):
    projects = {p["teams"]: p for p in irp["projects"]}
    reactors = projects["20277"]

    assert reactors["id"] == "gpc-20277"
    assert reactors["utility"] == "GPC" and reactors["sponsor_raw"] == "SAV"
    assert reactors["window_start"] == "2024-01-01" and reactors["window_end"] == "2026-06-01"
    assert reactors["window_method"] == "gpc_start_need"
    assert reactors["endpoint_names"] == ["MCINTOSH", "PURRYSBURG"]
    assert reactors["change_notes"]["vs_prev_irp"] == "New Project"
    assert {e["page"] for e in reactors["evidence"]} >= {227}
    assert projects["18670"]["utility"] == "other_utility"


def test_real_answer_key_gpc_projects_present(irp):
    names = {p["name"] for p in irp["projects"]}

    assert "MITCHELL - NORTH TIFTON 230KV RECONDUCTOR" in names
    assert "JESUP - LUDOWICI PRIMARY 115KV REBUILD" in names


def test_real_completed_and_cancelled_tables(irp):
    completed = {r["teams"] for r in irp["completed_rows"]}

    assert len(irp["completed_rows"]) == 13
    assert "14271" in completed  # THOMSON PRI - WARRENTON PRI 115KV WHITE LINE REBUILD
    assert len(irp["cancelled_rows"]) == 10


def test_real_table_vs_detail_need_date_conflicts_are_flagged(irp):
    flagged = {p["teams"]: p for p in irp["projects"] if "sources_disagree" in p["flags"]}

    assert set(flagged) == {"19523", "20684", "17900"}
    assert flagged["17900"]["disagreements"] == [
        {"field": "need_date", "values": {"table_2": "2026-04-01", "detail_page": "2026-06-01"}}]


def test_real_gpc_line_miles_come_from_description(irp):
    reactors = next(p for p in irp["projects"] if p["teams"] == "20277")

    assert reactors["line_miles"] == 0.1


def test_real_gpc_projects_carry_voltage_from_their_name(irp):
    projects = {p["teams"]: p for p in irp["projects"]}

    assert projects["20277"]["voltage_kv"] == 230  # MCINTOSH - PURRYSBURG 230KV REACTORS
    assert projects["20065"]["voltage_kv"] == 115  # GOSHEN - MCINTOSH 115KV LINE REBUILD
    assert all("voltage_kv" in p for p in irp["projects"])
