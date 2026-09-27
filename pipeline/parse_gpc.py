"""Parse GPC 2025 IRP Vol 3 Public Disclosure (contracts §1.3).

- Table 2 (pp.177-190): zone, year, TEAMS, project name, need date, sponsor. Cost columns are REDACTED.
- Table 3 (p.191) cancelled and Table 4 (p.192) completed, for the change view.
- Detail pages keyed by "Teams # NNNNN": need/start dates, description, change notes.

CEII rule: only unredacted public fields are read. Supporting statements and costs are never stored.
"""
import datetime as dt
import re
from pathlib import Path

import pymupdf

from pipeline.normalize import endpoint_names
from pipeline.parse_desc import stated_miles, voltage_kv

SOURCE_ID = "gpc-irp25-v3"
PLAN_PAGES = range(177, 191)
CANCELLED_PAGES = range(191, 192)
COMPLETED_PAGES = range(192, 193)
GPC_SPONSORS = {"GPC", "SAV"}
TABLE_ROW_KINDS = {"plan": True, "cancelled": False, "completed": False}  # kind -> has Year column
SPONSORED_KINDS = {"plan", "cancelled"}

DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
ZONE = re.compile(r"^\d{3}$")
YEAR = re.compile(r"^(19|20)\d{2}$")
TEAMS = re.compile(r"^\d{4,6}$")
TEAMS_LINE = re.compile(r"Teams\s*#\s*(\d+)")
DATES_LINE = re.compile(r"Need Date\s+(\S+)\s+Start Date\s+(\S+)")
DETAIL_LABELS = {
    "Description": "description",
    "Supporting Statement": None,  # REDACTED in the public copy: never stored
    "Change From Previous Ten Year Plan": "change_vs_prev_ten_year",
    "Change From Previous IRP": "change_vs_prev_irp",
    "Estimated Cost": None,
}
BANNER_BOTTOM_Y = 86
REDACTED = "REDACTED"


class GpcParseError(ValueError):
    pass


def iso_date(text: str) -> str:
    match = DATE.match(text.strip())
    if not match:
        raise GpcParseError(f"not a M/D/YYYY date: {text!r}")
    month, day, year = (int(g) for g in match.groups())
    return dt.date(year, month, day).isoformat()


def _body_lines(lines: list[str]) -> list[str]:
    """Lines after the table header (which ends at 'Totals' or the last header label)."""
    cleaned = [ln.strip() for ln in lines if ln.strip()]
    header_end = max((i for i, ln in enumerate(cleaned) if ln in ("Totals", "Need Date")), default=-1)
    return [ln for ln in cleaned[header_end + 1:] if ln != "PUBLIC DISCLOSURE" and not ln.startswith(REDACTED)]


def parse_table_lines(lines: list[str], kind: str, page: int) -> list[dict]:
    has_year = TABLE_ROW_KINDS[kind]
    has_sponsor = kind in SPONSORED_KINDS
    body = _body_lines(lines)
    rows, i = [], 0
    while i < len(body):
        if not ZONE.match(body[i]):
            i += 1
            continue
        row = {"kind": kind, "page": page, "zone": body[i]}
        i += 1
        if has_year:
            row["year"], i = body[i], i + 1
        if not TEAMS.match(body[i]):
            raise GpcParseError(f"p.{page}: expected TEAMS number, got {body[i]!r}")
        row["teams"], i = body[i], i + 1
        name_lines = []
        while i < len(body) and not DATE.match(body[i]):
            name_lines.append(body[i])
            i += 1
        row["name"] = re.sub(r"\s+", " ", " ".join(name_lines)).strip()
        row["need_date_raw"] = body[i]
        row["need_date"], i = iso_date(body[i]), i + 1
        if has_sponsor:
            row["sponsor"], i = body[i].strip(), i + 1
        rows.append(row)
    return rows


def _label_of(text: str) -> str | None:
    return next((label for label in DETAIL_LABELS if text.startswith(label)), None)


def parse_detail_blocks(blocks: list[tuple], page: int) -> dict:
    content = [(b[0], b[1], b[4].strip()) for b in blocks if b[1] > BANNER_BOTTOM_Y and b[4].strip()]
    teams_block = next(c for c in content if TEAMS_LINE.search(c[2]))
    dates = next(DATES_LINE.search(c[2]) for c in content if DATES_LINE.search(c[2]))
    title = " ".join(c[2] for c in content if c[1] < teams_block[1])

    labels = sorted((c[1], _label_of(c[2])) for c in content if _label_of(c[2]))
    values: dict[str, list[str]] = {}
    for _, y, text in sorted(content, key=lambda c: c[1]):
        if _label_of(text) or text == REDACTED or y < labels[0][0]:
            continue
        owner = [label for label_y, label in labels if label_y <= y]
        field = DETAIL_LABELS.get(owner[-1]) if owner else None
        if field:
            values.setdefault(field, []).append(re.sub(r"\s+", " ", text))

    return {
        "page": page,
        "teams": TEAMS_LINE.search(teams_block[2]).group(1),
        "title": re.sub(r"\s+", " ", title).strip(),
        "need_date": iso_date(dates.group(1)),
        "start_date": iso_date(dates.group(2)),
        "need_date_raw": dates.group(1),
        "start_date_raw": dates.group(2),
        **{field: " ".join(v) for field, v in values.items()},
    }


def _project(row: dict, detail: dict | None) -> dict:
    sponsor = row["sponsor"]
    detail = detail or {}

    def cite(field: str, quote: str, page: int) -> dict:
        return {"field": field, "quote": quote, "page": page, "source_id": SOURCE_ID}

    evidence = [cite("name", row["name"], row["page"]), cite("teams", row["teams"], row["page"]),
                cite("need_date", row["need_date_raw"], row["page"]), cite("sponsor", sponsor, row["page"])]
    if detail:
        evidence += [cite("start_date", detail["start_date_raw"], detail["page"])]
        evidence += [cite(f, detail[f], detail["page"]) for f in
                     ("description", "change_vs_prev_ten_year", "change_vs_prev_irp") if detail.get(f)]
    disagreements = []
    if detail.get("need_date") and detail["need_date"] != row["need_date"]:
        disagreements.append({"field": "need_date",
                              "values": {"table_2": row["need_date"], "detail_page": detail["need_date"]}})
    return {
        "id": f"gpc-{row['teams']}",
        "teams": row["teams"],
        "utility": "GPC" if sponsor in GPC_SPONSORS else "other_utility",
        "sponsor_raw": sponsor,
        "zone": row["zone"],
        "source_id": SOURCE_ID,
        "page": row["page"],
        "detail_page": detail.get("page"),
        "name": row["name"],
        "description": detail.get("description"),
        "need_text": None,
        "status": None,
        "in_service_date": row["need_date"],
        "in_service_raw": row["need_date_raw"],
        "in_service_page": row["page"],
        "date_precision": "day",
        "window_start": detail.get("start_date"),
        "window_end": row["need_date"] if detail.get("start_date") else None,
        "window_method": "gpc_start_need" if detail.get("start_date") else None,
        "endpoint_names": endpoint_names(row["name"]),
        "voltage_kv": voltage_kv(row["name"]),
        "line_miles": stated_miles(detail.get("description") or ""),
        "cost_public": None,
        "change_notes": {"vs_prev_ten_year": detail.get("change_vs_prev_ten_year"),
                         "vs_prev_irp": detail.get("change_vs_prev_irp")} if detail else None,
        "detail_need_date": detail.get("need_date"),
        "disagreements": disagreements,
        "flags": ["sources_disagree"] if disagreements else [],
        "evidence": evidence,
    }


def _table(doc, pages: range, kind: str) -> list[dict]:
    return [row for n in pages for row in parse_table_lines(doc[n - 1].get_text().splitlines(), kind, n)]


def parse_irp(path: Path) -> dict:
    with pymupdf.open(path) as doc:
        plan = _table(doc, PLAN_PAGES, "plan")
        cancelled = _table(doc, CANCELLED_PAGES, "cancelled")
        completed = _table(doc, COMPLETED_PAGES, "completed")
        details = {}
        for n in range(COMPLETED_PAGES.stop, doc.page_count + 1):
            page = doc[n - 1]
            if TEAMS_LINE.search(page.get_text()):
                detail = parse_detail_blocks(page.get_text("blocks"), n)
                details.setdefault(detail["teams"], detail)
    projects = [_project(row, details.get(row["teams"])) for row in plan]
    return {"source_id": SOURCE_ID, "plan_rows": plan, "cancelled_rows": cancelled,
            "completed_rows": completed, "details": details, "projects": projects}
