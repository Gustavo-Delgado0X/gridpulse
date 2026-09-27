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


def test_reused_desc_id_with_a_different_project_is_not_a_slip_or_rename():
    old = [desc("6809 G", "Stevens Creek - Hooks 115kV/LR Plumb Branch 46kV", "2025-12-31", 7_800_000)]
    new = [desc("6809 G", "Hooks - Modoc 115/46 kV Rebuild", "2027-12-31", 10_534_285, source="desc-2529")]

    events = desc_changes([("desc-2428", old), ("desc-2529", new)])

    assert [e["event"] for e in events] == ["id_reused"]
    assert events[0]["before"].startswith("Stevens Creek") and events[0]["after"].startswith("Hooks - Modoc")


def test_desc_events_carry_the_primary_list_id_used_by_opportunities():
    old = [desc("6367 D - G", "Jasper – Okatie 230 kV #2: Construct", "2025-12-31")]
    mid = [desc("6367 D - G", "Jasper – Okatie 230 kV #2: Construct", "2026-05-31", source="desc-2529")]
    new = [desc("6367 D - G", "Jasper – Okatie 230 kV #2: Construct", "2026-12-01", source="desc-2630"),
           desc("9999", "Brand New Tap", "2028-12-31", source="desc-2630")]

    events = desc_changes([("desc-2428", old), ("desc-2529", mid), ("desc-2630", new)])

    slips = [e for e in events if e["event"] == "slipped"]
    assert {e["primary_id"] for e in slips} == {"desc-2428-6367 D - G"}
    assert next(e for e in events if e["event"] == "new")["primary_id"] is None


def test_evidence_quotes_use_the_date_as_printed():
    old = [{**desc("6810 A", "Hooks - Thurmond", "2024-12-31"), "in_service_raw": "12/31/24"}]
    new = [{**desc("6810 A", "Hooks - Thurmond", "2025-12-31", source="desc-2529"), "in_service_raw": "12/31/2025"}]

    [slip] = desc_changes([("desc-2428", old), ("desc-2529", new)])

    assert [e["quote"] for e in slip["evidence"]] == ["12/31/24", "12/31/2025"]
    assert (slip["before"], slip["after"]) == ("2024-12-31", "2025-12-31")


def test_ambiguous_sertp_keys_are_not_matched():
    gpc = [{"id": "gpc-1", "utility": "GPC", "name": "ECHECONNEE-WELLSTON 115KV REBUILD", "in_service_date": "2025-06-01",
            "detail_page": 1, "source_id": "gpc-irp25-v3"},
           {"id": "gpc-2", "utility": "GPC", "name": "ECHECONNEE - WELLSTON 115KV REBUILD", "in_service_date": "2030-06-01",
            "detail_page": 2, "source_id": "gpc-irp25-v3"}]
    sertp = {"sertp-2026": [{"name": "SOCO: ECHECONNEE - WELLSTON 115 KV REBUILD", "year": 2030, "page": 5}]}
    dup_sertp = {"sertp-2026": [{"name": "SOCO: A - B 115 KV REBUILD", "year": 2027, "page": 5},
                                {"name": "SOCO: A - B 115 KV REBUILD", "year": 2030, "page": 9}]}
    one = [{**gpc[0], "id": "gpc-3", "name": "A - B 115KV REBUILD"}]

    assert sertp_disagreements(gpc, sertp) == []       # two IRP projects share the key
    assert sertp_disagreements(one, dup_sertp) == []   # two SERTP entries share the key


def test_sertp_evidence_quotes_the_printed_name_not_a_synthesized_sentence():
    gpc = [{"id": "gpc-20065", "utility": "GPC", "name": "SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD",
            "in_service_date": "2027-06-01", "in_service_raw": "6/1/2027", "detail_page": 250, "page": 180, "source_id": "gpc-irp25-v3"}]
    sertp = {"sertp-2026": [{"name": "SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD", "year": 2028, "page": 53}]}

    [event] = sertp_disagreements(gpc, sertp)

    assert event["evidence"][0]["quote"] == "6/1/2027"
    assert event["evidence"][1]["quote"] == "SOCO: SAV: GOSHEN (SAV) - MCINTOSH 115 KV LINE REBUILD"
    assert event["primary_id"] == "gpc-20065"
