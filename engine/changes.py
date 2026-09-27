"""Plan-change detection across plan versions and sources (contracts §2.7).

- DESC list versions: matched by Project ID -> new, removed, slipped, moved_earlier, renamed, cost_changed; an ID reused
  for a different project (names share too few words) becomes id_reused instead of a fake slip/rename.
- GPC IRP: Table 3 cancelled, Table 4 completed, detail-page change notes (new vs previous IRP, changed).
- GPC IRP vs SERTP: matched by a normalized project key -> sources_disagree when in-service years differ. Keys shared by
  more than one IRP project or more than one SERTP entry are ambiguous and never matched.

Every event carries primary_id: the id of the same project in the list the opportunities are ranked on (DESC 2024-28,
GPC IRP), or None when the project is not in that list. Evidence quotes are the text as printed in the source.
"""

import re

SPONSOR_PREFIX = re.compile(r"^(SOCO|SAV|GTC|MEAG|DU|GPC|APC|MPC|GULF|OPC)\s*:\s*")
VOLTAGE = re.compile(r"(\d+(?:\s*/\s*\d+)?)\s*KV\b")
TOKEN = re.compile(r"#\s*\d+|[A-Z0-9]+")
STOP_WORDS = {
    "KV",
    "LINE",
    "LINES",
    "TL",
    "TRANSMISSION",
    "REBUILD",
    "RECONDUCTOR",
    "UPGRADE",
    "PARTIAL",
    "THE",
    "AND",
    "OF",
    "PROJECT",
    "SUBSTATION",
    "SUB",
}
COST_CHANGE_RATIO = 0.05
SAME_PROJECT_MIN_OVERLAP = 0.3
NAME_WORD = re.compile(r"[a-z]{2,}")
GENERIC_WORDS = {
    "kv",
    "construct",
    "rebuild",
    "line",
    "sub",
    "substation",
    "tap",
    "and",
    "the",
    "to",
    "from",
    "replace",
    "with",
}


def project_key(name: str) -> str:
    text = name.upper()
    while SPONSOR_PREFIX.match(text):
        text = SPONSOR_PREFIX.sub("", text, count=1)
    text = re.sub(r"\([^)]*\)", " ", text).split(",")[0]
    voltages = [v.replace(" ", "") for v in VOLTAGE.findall(text)]
    text = VOLTAGE.sub(" ", text)
    tokens = sorted({t.replace(" ", "") for t in TOKEN.findall(text)} - STOP_WORDS)
    return " ".join(tokens) + "|" + ",".join(voltages)


def _cite(project: dict, quote: str, page: int | None = None) -> dict:
    return {
        "source_id": project["source_id"],
        "page": page or project.get("detail_page") or project["page"],
        "quote": quote,
    }


def _date_cite(project: dict) -> dict:
    """The in-service date exactly as printed (falls back to ISO when the raw text is unknown)."""
    return _cite(project, project.get("in_service_raw") or project["in_service_date"], project.get("in_service_page"))


def _event(
    project: dict,
    event: str,
    before: str | None,
    after: str | None,
    evidence: list[dict],
    primary_id: str | None = None,
) -> dict:
    return {
        "project_id": project["id"],
        "primary_id": primary_id,
        "utility": project["utility"],
        "name": project["name"],
        "event": event,
        "before": before,
        "after": after,
        "evidence": evidence,
    }


def _name_words(name: str) -> set[str]:
    return set(NAME_WORD.findall(name.lower())) - GENERIC_WORDS


def same_project(old_name: str, new_name: str) -> bool:
    a, b = _name_words(old_name), _name_words(new_name)
    if not a or not b:
        return True
    return len(a & b) / len(a | b) >= SAME_PROJECT_MIN_OVERLAP


def _key(project: dict) -> str:
    return project["id"].removeprefix(project["source_id"] + "-")


def _pair_events(old: dict, new: dict, primary_id: str | None) -> list[dict]:
    names = [_cite(old, old["name"]), _cite(new, new["name"])]
    if not same_project(old["name"], new["name"]):
        return [_event(new, "id_reused", old["name"], new["name"], names, primary_id)]
    events = []
    if new["in_service_date"] != old["in_service_date"]:
        kind = "slipped" if new["in_service_date"] > old["in_service_date"] else "moved_earlier"
        events.append(
            _event(
                new,
                kind,
                old["in_service_date"],
                new["in_service_date"],
                [_date_cite(old), _date_cite(new)],
                primary_id,
            )
        )
    if " ".join(new["name"].split()) != " ".join(old["name"].split()):
        events.append(_event(new, "renamed", old["name"], new["name"], names, primary_id))
    before, after = (old.get("cost_public") or {}).get("total_usd"), (new.get("cost_public") or {}).get("total_usd")
    if before and after and abs(after - before) / before > COST_CHANGE_RATIO:
        events.append(
            _event(
                new,
                "cost_changed",
                f"${before:,}",
                f"${after:,}",
                [_cite(old, f"${before:,}"), _cite(new, f"${after:,}")],
                primary_id,
            )
        )
    return events


def desc_changes(versions: list[tuple[str, list[dict]]]) -> list[dict]:
    """versions: chronological [(source_id, projects)]."""
    if not versions:
        return []
    primary_source, primary = versions[0]
    primary_by = {_key(p): p for p in primary}

    def primary_id(key: str, project: dict) -> str | None:
        anchor = primary_by.get(key)
        return anchor["id"] if anchor and same_project(anchor["name"], project["name"]) else None

    events = []
    for (_, older), (_, newer) in zip(versions, versions[1:], strict=False):
        old_by, new_by = {_key(p): p for p in older}, {_key(p): p for p in newer}
        for key, new in new_by.items():
            old = old_by.get(key)
            if old is None:
                events.append(
                    _event(new, "new", None, new["in_service_date"], [_cite(new, new["name"])], primary_id(key, new))
                )
            else:
                events.extend(_pair_events(old, new, primary_id(key, new)))
        events.extend(
            _event(old, "removed", old["in_service_date"], None, [_cite(old, old["name"])], primary_id(key, old))
            for key, old in old_by.items()
            if key not in new_by
        )
    return events


def gpc_table_changes(tables: dict, projects: list[dict]) -> list[dict]:
    events = []
    for kind in ("cancelled", "completed"):
        for row in tables.get(kind, []):
            project = {"id": f"gpc-{row['teams']}", "utility": "GPC", "name": row["name"]}
            events.append(
                _event(
                    project,
                    kind,
                    row["need_date"],
                    None,
                    [{"source_id": "gpc-irp25-v3", "page": row["page"], "quote": row["name"]}],
                )
            )  # not in plan
    for p in projects:
        notes = p.get("change_notes") or {}
        vs_irp, vs_plan = notes.get("vs_prev_irp"), notes.get("vs_prev_ten_year")
        if vs_irp == "New Project":
            events.append(_event(p, "new", None, p["in_service_date"], [_cite(p, vs_irp)], p["id"]))
        for text in (vs_irp, vs_plan):
            if text and text not in ("No Change", "New Project"):
                events.append(_event(p, "changed", None, text, [_cite(p, text)], p["id"]))
                break
    return events


def _unique_index(entries: list[dict], key_of) -> dict[str, dict]:
    """Key -> entry, dropping keys that more than one entry shares (ambiguous: never matched)."""
    counts: dict[str, int] = {}
    for e in entries:
        counts[key_of(e)] = counts.get(key_of(e), 0) + 1
    return {key_of(e): e for e in entries if counts[key_of(e)] == 1}


def sertp_disagreements(gpc_projects: list[dict], sertp: dict[str, list[dict]]) -> list[dict]:
    indexed = {source: _unique_index(entries, lambda e: project_key(e["name"])) for source, entries in sertp.items()}
    unique_gpc = _unique_index(gpc_projects, lambda p: project_key(p["name"]))
    latest = sorted(sertp)[-1] if sertp else None
    events = []
    for key, p in unique_gpc.items():
        matches = {source: index[key] for source, index in indexed.items() if key in index}
        current = matches.get(latest)
        irp_year = int(p["in_service_date"][:4])
        if current is None or current["year"] == irp_year:
            continue
        evidence = [_date_cite(p)] + [
            {"source_id": source, "page": entry["page"], "quote": entry["name"]}
            for source, entry in sorted(matches.items())
        ]
        label = latest.replace("sertp-", "SERTP ")
        events.append(
            _event(p, "sources_disagree", f"IRP {irp_year}", f"{label}: {current['year']}", evidence, p["id"])
        )
    return events
