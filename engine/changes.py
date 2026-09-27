"""Plan-change detection across plan versions and sources (contracts §2.7).

- DESC list versions: matched by Project ID -> new, removed, slipped, moved_earlier, renamed, cost_changed.
- GPC IRP: Table 3 cancelled, Table 4 completed, detail-page change notes (new vs previous IRP, changed).
- GPC IRP vs SERTP: matched by a normalized project key -> sources_disagree when in-service years differ.
"""
import re

SPONSOR_PREFIX = re.compile(r"^(SOCO|SAV|GTC|MEAG|DU|GPC|APC|MPC|GULF|OPC)\s*:\s*")
VOLTAGE = re.compile(r"(\d+(?:\s*/\s*\d+)?)\s*KV\b")
TOKEN = re.compile(r"#\s*\d+|[A-Z0-9]+")
STOP_WORDS = {"KV", "LINE", "LINES", "TL", "TRANSMISSION", "REBUILD", "RECONDUCTOR", "UPGRADE", "PARTIAL", "THE",
              "AND", "OF", "PROJECT", "SUBSTATION", "SUB"}
COST_CHANGE_RATIO = 0.05


def project_key(name: str) -> str:
    text = name.upper()
    while SPONSOR_PREFIX.match(text):
        text = SPONSOR_PREFIX.sub("", text, count=1)
    text = re.sub(r"\([^)]*\)", " ", text).split(",")[0]
    voltages = [v.replace(" ", "") for v in VOLTAGE.findall(text)]
    text = VOLTAGE.sub(" ", text)
    tokens = sorted({t.replace(" ", "") for t in TOKEN.findall(text)} - STOP_WORDS)
    return " ".join(tokens) + "|" + ",".join(voltages)


def _cite(project: dict, quote: str) -> dict:
    return {"source_id": project["source_id"], "page": project.get("detail_page") or project["page"], "quote": quote}


def _event(project: dict, event: str, before: str | None, after: str | None, evidence: list[dict]) -> dict:
    return {"project_id": project["id"], "utility": project["utility"], "name": project["name"], "event": event,
            "before": before, "after": after, "evidence": evidence}


def _key(project: dict) -> str:
    return project["id"].removeprefix(project["source_id"] + "-")


def _pair_events(old: dict, new: dict) -> list[dict]:
    events = []
    evidence = [_cite(old, old["in_service_date"]), _cite(new, new["in_service_date"])]
    if new["in_service_date"] != old["in_service_date"]:
        kind = "slipped" if new["in_service_date"] > old["in_service_date"] else "moved_earlier"
        events.append(_event(new, kind, old["in_service_date"], new["in_service_date"], evidence))
    if " ".join(new["name"].split()) != " ".join(old["name"].split()):
        names = [_cite(old, old["name"]), _cite(new, new["name"])]
        events.append(_event(new, "renamed", old["name"], new["name"], names))
    before, after = (old.get("cost_public") or {}).get("total_usd"), (new.get("cost_public") or {}).get("total_usd")
    if before and after and abs(after - before) / before > COST_CHANGE_RATIO:
        events.append(_event(new, "cost_changed", f"${before:,}", f"${after:,}",
                             [_cite(old, f"${before:,}"), _cite(new, f"${after:,}")]))
    return events


def desc_changes(versions: list[tuple[str, list[dict]]]) -> list[dict]:
    """versions: chronological [(source_id, projects)]."""
    events = []
    for (_, older), (_, newer) in zip(versions, versions[1:], strict=False):
        old_by, new_by = {_key(p): p for p in older}, {_key(p): p for p in newer}
        for key, new in new_by.items():
            old = old_by.get(key)
            if old is None:
                events.append(_event(new, "new", None, new["in_service_date"], [_cite(new, new["name"])]))
            else:
                events.extend(_pair_events(old, new))
        events.extend(_event(old, "removed", old["in_service_date"], None, [_cite(old, old["name"])])
                      for key, old in old_by.items() if key not in new_by)
    return events


def gpc_table_changes(tables: dict, projects: list[dict]) -> list[dict]:
    events = []
    for kind in ("cancelled", "completed"):
        for row in tables.get(kind, []):
            project = {"id": f"gpc-{row['teams']}", "utility": "GPC", "name": row["name"]}
            events.append(_event(project, kind, row["need_date"], None,
                                 [{"source_id": "gpc-irp25-v3", "page": row["page"], "quote": row["name"]}]))
    for p in projects:
        notes = p.get("change_notes") or {}
        vs_irp, vs_plan = notes.get("vs_prev_irp"), notes.get("vs_prev_ten_year")
        if vs_irp == "New Project":
            events.append(_event(p, "new", None, p["in_service_date"], [_cite(p, vs_irp)]))
        for text in (vs_irp, vs_plan):
            if text and text not in ("No Change", "New Project"):
                events.append(_event(p, "changed", None, text, [_cite(p, text)]))
                break
    return events


def sertp_disagreements(gpc_projects: list[dict], sertp: dict[str, list[dict]]) -> list[dict]:
    indexed = {source: {project_key(e["name"]): e for e in entries} for source, entries in sertp.items()}
    latest = sorted(sertp)[-1] if sertp else None
    events = []
    for p in gpc_projects:
        key = project_key(p["name"])
        matches = {source: index[key] for source, index in indexed.items() if key in index}
        current = matches.get(latest)
        irp_year = int(p["in_service_date"][:4])
        if current is None or current["year"] == irp_year:
            continue
        evidence = [_cite(p, p["in_service_date"])] + [
            {"source_id": source, "page": entry["page"], "quote": f"In-Service Year {entry['year']}: {entry['name']}"}
            for source, entry in sorted(matches.items())]
        label = latest.replace("sertp-", "SERTP ")
        events.append(_event(p, "sources_disagree", f"IRP {irp_year}", f"{label}: {current['year']}", evidence))
    return events
