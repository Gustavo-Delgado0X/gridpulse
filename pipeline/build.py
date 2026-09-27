"""Offline build: parse -> locate (OSM) -> overrides -> engine -> data/processed/*.json.

Sperry's answer key is only a benchmark: it labels projects and is compared against, never copied into locations.

Run: python -m pipeline.build   (needs data/raw/ PDFs and data/cache/ OSM pulls; see README)
Outputs are public, unredacted facts only and are committed so the API runs without raw sources.
"""

import csv
import datetime as dt
import hashlib
import json
from pathlib import Path

from engine.changes import desc_changes, gpc_table_changes, sertp_disagreements
from engine.distance import haversine_mi
from engine.opportunities import find_opportunities
from pipeline.locate import OsmIndex, core_name, locate_endpoint
from pipeline.parse_answer_key import to_engine_projects
from pipeline.parse_desc import parse_pdf
from pipeline.parse_gpc import parse_irp
from pipeline.parse_sertp import parse_sertp

ROOT = Path(__file__).resolve().parents[1]
RAW, CACHE, OVERRIDES, PROCESSED = (ROOT / "data" / d for d in ("raw", "cache", "overrides", "processed"))
KEY_FIXTURE = ROOT / "tests" / "fixtures" / "answer_key.json"
LISTINGS = RAW / "starter" / "Project Listings"
DESC_2428 = LISTINGS / "Dominion Energy" / "2024-2028-2million-and-above-project-descriptions.pdf"
GPC_IRP = LISTINGS / "Georgia Power" / "2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf"
MAX_PRECOMPUTED_MILES = 50.0
COORDINATE_CONFLICT_MI = 0.05
STATE_OF = {"DESC": "SC", "GPC": "GA"}
DESC_VERSIONS = (("desc-2529", RAW / "desc_2025-2029.pdf"), ("desc-2630", RAW / "desc_2026-2030.pdf"))
SERTP = {sid: RAW / f"sertp_{sid[-4:]}_preliminary_non_ceii.pdf" for sid in ("sertp-2025", "sertp-2026")}


def _same_facility(a: str, b: str) -> bool:
    return core_name(a) == core_name(b)


def _conflict(project_id: str, endpoint: dict, key_ep: dict) -> dict | None:
    if endpoint.get("lat") is None:
        return None
    miles = haversine_mi((endpoint["lat"], endpoint["lon"]), (key_ep["lat"], key_ep["lon"]))
    if miles <= COORDINATE_CONFLICT_MI:
        return None
    return {
        "kind": "coordinate_conflict",
        "project_id": project_id,
        "endpoint": endpoint["name_raw"],
        "miles_apart": round(miles, 3),
        "values": {"osm": [endpoint["lat"], endpoint["lon"]], "answer_key": [key_ep["lat"], key_ep["lon"]]},
        "message": f"{endpoint['name_raw']}: OSM and Sperry's answer key differ by {miles:.2f} mi; "
        "GridPulse uses OpenStreetMap",
    }


def _key_conflicts(project: dict, key_project: dict) -> list[dict]:
    conflicts = []
    for key_ep in key_project["endpoints"]:
        if key_ep["lat"] is None:
            continue
        ours = next((e for e in project["endpoints"] if _same_facility(e["name_raw"], key_ep["name"])), None)
        if ours is not None and (conflict := _conflict(project["id"], ours, key_ep)):
            conflicts.append(conflict)
    return conflicts


def link_answer_key(projects: list[dict], key: dict, links: dict[str, str]) -> tuple[list[dict], list[dict]]:
    """Label projects with their answer-key id and report coordinate disagreements.

    The answer key is a benchmark, never a data source: no coordinate from it is copied into a project.
    """
    by_project = {links[k["project_id"]]: k for k in key["projects"] if k["project_id"] in links}
    result, discrepancies = [], []
    for project in projects:
        key_project = by_project.get(project["id"])
        if key_project is None:
            result.append(project)
            continue
        result.append({**project, "answer_key_id": key_project["project_id"]})
        discrepancies.extend(_key_conflicts(project, key_project))
    return result, discrepancies


def independent_check(key: dict, links: dict[str, str], opportunities: dict[str, list[dict]]) -> dict:
    """Which answer-key pairs GridPulse finds with its own locations (OSM + reviewed overrides, no key coordinates)."""
    closest = {(o["a"], o["b"]): o for o in opportunities["closest"]}
    center = {(o["a"], o["b"]): o for o in opportunities["center"]}
    rows = []
    for expected in key["overlaps"]:
        pair = (links.get(expected["project_id_a"]), links.get(expected["project_id_b"]))
        got, got_center = closest.get(pair), center.get(pair)
        rows.append(
            {
                "overlap_id": expected["overlap_id"],
                "expected_mi": expected["distance_mi"],
                "got_center_mi": got_center and round(got_center["dist_center_mi"], 2),
                "tier": got and got["tier"],
                "touching": bool(got and got["touching"]),
                "got_closest_mi": got and round(got["dist_closest_mi"], 2),
                "expected_gap": expected["time_gap_days"],
                "got_gap": got and got["in_service_gap_days"],
                "found": bool(got and got["tier"]),
            }
        )
    return {"found": sum(r["found"] for r in rows), "expected": len(rows), "details": rows}


def apply_overrides(projects: list[dict], rows: list[dict]) -> list[dict]:
    by_id = {r["endpoint_id"]: r for r in rows}

    def override(endpoint: dict) -> dict:
        row = by_id.get(endpoint["id"])
        if row is None:
            return endpoint
        return {
            **endpoint,
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "precision": row["precision"],
            "method": row["method"],
            "source": row["source"],
            "confirmed_by_pdf_context": row["confirmed_by_pdf_context"].strip().lower() == "true",
            "reviewer": row["reviewer"] or None,
            "notes": row.get("notes") or None,
        }

    return [{**p, "endpoints": [override(e) for e in p["endpoints"]]} for p in projects]


def _date_conflict(project: dict, disagreement: dict) -> dict:
    message = f"{project['name']}: need date differs between Table 2 and detail page p.{project['detail_page']}"
    return {
        "kind": "sources_disagree",
        "project_id": project["id"],
        "values": disagreement["values"],
        "message": message,
    }


def _locate(project: dict, index: OsmIndex) -> dict:
    state = STATE_OF[project["utility"]]
    endpoints = [
        locate_endpoint(name, state, project.get("zone"), project["name"], index, project.get("voltage_kv"))
        for name in project["endpoint_names"]
    ]
    return {**project, "state": state, "endpoints": endpoints}


def _read_csv(path: Path) -> list[dict]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _acceptance(key: dict) -> dict:
    projects = to_engine_projects(key)
    found = {(o["a"], o["b"]): o for o in find_opportunities(projects, method="center")}
    rows = []
    for expected in key["overlaps"]:
        got = found.get((expected["project_id_a"], expected["project_id_b"]))
        ok = (
            bool(got)
            and abs(got["dist_center_mi"] - expected["distance_mi"]) <= 0.01
            and got["in_service_gap_days"] == expected["time_gap_days"]
        )
        rows.append(
            {
                "overlap_id": expected["overlap_id"],
                "expected_mi": expected["distance_mi"],
                "got_mi": got and round(got["dist_center_mi"], 2),
                "expected_gap": expected["time_gap_days"],
                "got_gap": got and got["in_service_gap_days"],
                "passed": ok,
            }
        )
    extra = len(found) - sum(r["passed"] for r in rows)
    return {
        "passed": all(r["passed"] for r in rows) and extra == 0,
        "matched": sum(r["passed"] for r in rows),
        "expected": len(rows),
        "unexpected": extra,
        "details": rows,
    }


def _coverage(projects: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for p in projects:
        for e in p["endpoints"]:
            counts[e["precision"]] = counts.get(e["precision"], 0) + 1
    located = sum(1 for p in projects if any(e["lat"] is not None for e in p["endpoints"]))
    return {
        "projects": len(projects),
        "projects_located": located,
        "projects_unlocated": len(projects) - located,
        "endpoints_by_precision": counts,
    }


def _write(name: str, payload: object) -> None:
    (PROCESSED / name).write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")


def _with_sertp_flags(projects: list[dict], events: list[dict]) -> list[dict]:
    flagged = {e["project_id"]: e for e in events}

    def flag(p: dict) -> dict:
        event = flagged.get(p["id"])
        if event is None:
            return p
        disagreement = {"field": "in_service_year", "values": {"irp": event["before"], "sertp": event["after"]}}
        return {
            **p,
            "flags": sorted({*p.get("flags", []), "sources_disagree"}),
            "disagreements": [*p.get("disagreements", []), disagreement],
        }

    return [flag(p) for p in projects]


def _parser_anomalies(versions: list[tuple[str, list[dict]]], changes: list[dict]) -> list[dict]:
    """Issues the parsers resolved silently: cost tables that do not sum, normalized dates, reused Project IDs."""
    issues = []
    for _, projects in versions:
        for p in projects:
            cost = p.get("cost_public") or {}
            if cost.get("sums_match") is False:
                parts = cost["previous_usd"] + sum(cost["by_year"].values())
                issues.append(
                    {
                        "kind": "cost_table_mismatch",
                        "project_id": p["id"],
                        "values": {"columns_sum": f"${parts:,}", "stated_total": f"${cost['total_usd']:,}"},
                        "message": f"{p['name']}: cost columns sum to ${parts:,} but the Total column says "
                        f"${cost['total_usd']:,} ({p['source_id']} p.{p['page']}); GridPulse shows the Total",
                    }
                )
            if p.get("date_quirk"):
                issues.append(
                    {
                        "kind": "date_normalized",
                        "project_id": p["id"],
                        "values": {"printed": p.get("in_service_raw"), "used": p["in_service_date"]},
                        "message": f"{p['name']}: in-service date {p['date_quirk']} ({p['source_id']} p.{p['page']})",
                    }
                )
            if p.get("id_quirk"):
                issues.append(
                    {
                        "kind": "id_reused",
                        "project_id": p["id"],
                        "values": {},
                        "message": f"{p['name']}: {p['id_quirk']} within {p['source_id']}",
                    }
                )
    issues += [
        {
            "kind": "id_reused",
            "project_id": c["project_id"],
            "values": {"before": c["before"], "after": c["after"]},
            "message": f"{c['after']}: Project ID reused from a different project "
            f"('{c['before']}'); not linked as a change",
        }
        for c in changes
        if c["event"] == "id_reused"
    ]
    return issues


def _changes(desc: list[dict], gpc: list[dict], irp: dict) -> tuple[list[dict], list[dict], list[dict]]:
    versions = [("desc-2428", desc)] + [(sid, parse_pdf(path, sid)) for sid, path in DESC_VERSIONS]
    sertp_events = sertp_disagreements(gpc, {sid: parse_sertp(path) for sid, path in SERTP.items()})
    tables = {"cancelled": irp["cancelled_rows"], "completed": irp["completed_rows"]}
    changes = desc_changes(versions) + gpc_table_changes(tables, gpc) + sertp_events
    return changes, sertp_events, _parser_anomalies(versions, changes)


def build() -> dict:
    key = json.loads(KEY_FIXTURE.read_text())
    links = {r["key_project_id"]: r["project_id"] for r in _read_csv(OVERRIDES / "answer_key_links.csv")}
    index = OsmIndex({s: json.loads((CACHE / f"osm_power_{s}.json").read_text())["elements"] for s in ("SC", "GA")})

    desc = parse_pdf(DESC_2428, "desc-2428")
    irp = parse_irp(GPC_IRP)
    gpc = [p for p in irp["projects"] if p["utility"] == "GPC"]
    others = [{**p, "state": "GA", "endpoints": []} for p in irp["projects"] if p["utility"] != "GPC"]

    changes, sertp_events, anomalies = _changes(desc, gpc, irp)
    gpc = _with_sertp_flags(gpc, sertp_events)
    located = [_locate(p, index) for p in [*desc, *gpc]]
    keyed, discrepancies = link_answer_key(located, key, links)
    projects = apply_overrides(keyed, _read_csv(OVERRIDES / "locations.csv"))
    discrepancies += [
        _date_conflict(p, d) for p in projects for d in p.get("disagreements", []) if d["field"] == "need_date"
    ]
    discrepancies += anomalies
    discrepancies += [
        {
            "kind": "sources_disagree",
            "project_id": e["project_id"],
            "values": {"irp": e["before"], "sertp": e["after"]},
            "message": f"{e['name']}: {e['before']} vs {e['after']}",
        }
        for e in sertp_events
    ]

    opportunities = {m: find_opportunities(projects, MAX_PRECOMPUTED_MILES, m) for m in ("closest", "center")}
    PROCESSED.mkdir(parents=True, exist_ok=True)
    _write("projects.json", [*projects, *others])
    _write("opportunities.json", opportunities)
    _write(
        "quality.json",
        {
            "coverage": _coverage(projects),
            "acceptance": _acceptance(key),
            "independent": independent_check(key, links, opportunities),
            "discrepancies": discrepancies,
            "built_at": dt.datetime.now(dt.UTC).isoformat(),
        },
    )
    _write("changes.json", changes)
    return {
        "projects": len(projects),
        "opportunities": {m: len(v) for m, v in opportunities.items()},
        "discrepancies": len(discrepancies),
        "changes": len(changes),
    }


if __name__ == "__main__":
    print(build())
