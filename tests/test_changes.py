"""Plan-change detection (contracts §2.7)."""
import pytest

from engine.changes import desc_changes, gpc_table_changes, project_key, sertp_disagreements
from pipeline.parse_sertp import parse_sertp_text


def desc(pid, name, date, total=100, page=1, source="desc-2428"):
    return {"id": f"{source}-{pid}", "project_id_raw": pid, "name": name, "in_service_date": date, "page": page,
            "source_id": source, "utility": "DESC", "cost_public": {"total_usd": total}}


@pytest.mark.parametrize(("a", "b"), [
    ("SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD", "SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD"),
    ("EVANS PRIMARY - THURMOND DAM (USA) #5 115KV REBUILD", "SOCO: EVANS PRIMARY - THURMOND DAM #5 115 KV TL REBUILD"),
])
def test_project_key_matches_across_naming_styles(a, b):
    assert project_key(a) == project_key(b)


def test_project_key_keeps_voltage_and_unit_numbers_distinct():
    assert project_key("A - B 115KV REBUILD") != project_key("A - B 230KV REBUILD")
    assert project_key("THURMOND DAM #5 115KV") != project_key("THURMOND DAM #6 115KV")


def test_desc_changes_between_versions():
    old = [desc("6810 A", "Hooks - Thurmond", "2024-12-31", 100), desc("6807 B", "Queensboro", "2023-12-31"),
           desc("6808 S", "Okatie-Bluffton", "2025-06-01", 100)]
    new = [desc("6810 A", "Hooks - Thurmond Tie", "2025-12-31", 100, source="desc-2529"),
           desc("6808 S", "Okatie-Bluffton", "2025-03-01", 150, source="desc-2529"),
           desc("9999", "Okatie - McIntosh 115 kV Tie: Add Series Reactor", "2027-12-31", source="desc-2529")]

    events = {(e["project_id"], e["event"]): e for e in desc_changes([("desc-2428", old), ("desc-2529", new)])}

    assert events[("desc-2529-6810 A", "slipped")]["before"] == "2024-12-31"
    assert events[("desc-2529-6810 A", "slipped")]["after"] == "2025-12-31"
    assert ("desc-2529-6810 A", "renamed") in events
    assert ("desc-2529-6808 S", "moved_earlier") in events
    assert events[("desc-2529-6808 S", "cost_changed")]["after"] == "$150"
    assert ("desc-2529-9999", "new") in events
    assert ("desc-2428-6807 B", "removed") in events
    assert all(e["evidence"] for e in events.values())


def test_gpc_table_changes_cover_cancelled_completed_and_new_vs_irp():
    tables = {"cancelled": [{"teams": "1", "name": "X - Y 115KV", "need_date": "2026-06-01", "page": 191, "sponsor": "GPC"}],
              "completed": [{"teams": "2", "name": "Z 230KV", "need_date": "2024-06-01", "page": 192}]}
    projects = [{"id": "gpc-3", "utility": "GPC", "name": "NEW ONE", "in_service_date": "2027-06-01", "detail_page": 300,
                 "source_id": "gpc-irp25-v3", "change_notes": {"vs_prev_irp": "New Project", "vs_prev_ten_year": "No Change"}},
                {"id": "gpc-4", "utility": "GPC", "name": "MOVED", "in_service_date": "2028-06-01", "detail_page": 301,
                 "source_id": "gpc-irp25-v3", "change_notes": {"vs_prev_irp": "No Change",
                                                               "vs_prev_ten_year": "Need date moved from 2027 to 2028"}}]

    events = {e["event"]: e for e in gpc_table_changes(tables, projects)}

    assert events["cancelled"]["evidence"][0]["page"] == 191
    assert events["completed"]["name"] == "Z 230KV"
    assert events["new"]["project_id"] == "gpc-3"
    assert events["changed"]["after"] == "Need date moved from 2027 to 2028"


def test_sertp_year_disagreement_is_flagged():
    gpc = [{"id": "gpc-20065", "utility": "GPC", "name": "SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD",
            "in_service_date": "2027-06-01", "detail_page": 250, "source_id": "gpc-irp25-v3"}]
    sertp = {"sertp-2025": [{"name": "SAV: GOSHEN (SAV) - MCINTOSH 115 KV TRANSMISSION LINE, REBUILD", "year": 2027, "page": 60}],
             "sertp-2026": [{"name": "SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD", "year": 2028, "page": 53}]}

    [event] = sertp_disagreements(gpc, sertp)

    assert event["event"] == "sources_disagree"
    assert event["before"] == "IRP 2027" and event["after"] == "SERTP 2026: 2028"
    assert {e["source_id"] for e in event["evidence"]} == {"gpc-irp25-v3", "sertp-2025", "sertp-2026"}


SERTP_PAGE = """SERTP TRANSMISSION PROJECTS (CEII)
Page 53 of 115
In-Service
Year:

2028
Project Name:
SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD
Description:
Rebuild the Goshen (Savannah) - Georgia Pacific (Rincon) section, approximately 6.7
miles, of the Goshen (Sav) - McIntosh 115 kV line.
Supporting
Statement:

The line overloads under contingency.

In-Service
Year:

2029
Project Name:
SOCO: OTHER 230 KV
Description:
Something.
"""


def test_parse_sertp_page_blocks():
    entries = parse_sertp_text(SERTP_PAGE, page=53)

    assert [(e["year"], e["name"]) for e in entries] == [
        (2028, "SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD"), (2029, "SOCO: OTHER 230 KV")]
    assert entries[0]["description"].endswith("115 kV line.")
    assert entries[0]["page"] == 53
