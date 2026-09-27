"""Parse DESC "Planned Transmission Projects $2M and above" lists, one project per page (contracts §1.2).

Every field is kept verbatim with a page-cited evidence quote. The build window is derived from the
public cost schedule: first year with spend (or the first list year when "Previous" spend exists)
through the planned in-service date.
"""
import calendar
import datetime as dt
import re
from pathlib import Path

import pymupdf

from pipeline.normalize import slug

EXPECTED_COUNTS = {"desc-2428": 44, "desc-2529": 47, "desc-2630": 54}
HEADERS = ("Project ID", "Project Description", "Project Need", "Project Status",
           "Planned In-Service Date", "Estimated Project Cost")
DATE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")
MILES = re.compile(r"(\d+(?:\.\d+)?)\s*miles?\b", re.IGNORECASE)
MONEY_TOKEN = re.compile(r"\$?\d[\d,]*(?:\.\d+)?")
VOLTAGE = re.compile(r"(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*kV", re.IGNORECASE)
WORK_TYPES = (("reactor", "reactor"), ("reconductor", "reconductor"), ("rebuild", "rebuild"),
              ("switching station", "switching_station"), ("construct", "new_line"), ("tap", "new_line"),
              ("upgrade", "upgrade"), ("sub", "substation"))


class DescParseError(ValueError):
    pass


def normalize_project_id(raw: str) -> str:
    return slug(raw).lstrip("0") or "0"


def parse_desc_date(raw: str) -> tuple[str, str | None]:
    """Returns (ISO date, quirk). Phased dates resolve to the final phase; impossible days clamp."""
    found = DATE.findall(raw)
    if not found:
        raise DescParseError(f"no date in {raw!r}")
    month, day, year = (int(x) for x in found[-1])
    year = year + 2000 if year < 100 else year
    last_day = calendar.monthrange(year, month)[1]
    quirks = []
    if len(found) > 1:
        quirks.append(f"phased: {raw.strip()}; final phase used")
    if day > last_day:
        quirks.append(f"invalid day {day} clamped to month end")
    return dt.date(year, month, min(day, last_day)).isoformat(), "; ".join(quirks) or None


def _money(text: str) -> int:
    return int(float(text.replace("$", "").replace(",", "").strip()))


def _sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = None
    for line in lines:
        if line in HEADERS:
            current = line
            sections[current] = []
        elif current:
            sections[current].append(line)
    return sections


def _title(lines: list[str]) -> str:
    start = lines.index("5 Year Budget") + 1
    end = lines.index("Project ID")
    return " ".join(lines[start:end]).strip()


def parse_cost_lines(lines: list[str]) -> dict:
    lines = [ln for ln in lines if not ln.startswith("*")]
    total_at = next((i for i, ln in enumerate(lines) if ln.startswith("Total")), None)
    if total_at is None:
        return _prose_cost(_joined(lines))
    labels = lines[: total_at + 1]
    values = [_money(tok) for tok in MONEY_TOKEN.findall(" ".join(lines[total_at + 1:]))]
    if len(labels) != len(values) or labels[0] != "Previous" or not labels[-1].startswith("Total"):
        raise DescParseError(f"cost table mismatch: {labels} vs {values}")
    by_year = dict(zip(labels[1:-1], values[1:-1], strict=True))
    sums_match = values[0] + sum(by_year.values()) == values[-1]
    return {"previous_usd": values[0], "by_year": by_year, "total_usd": values[-1], "sums_match": sums_match}


def _prose_cost(text: str) -> dict:
    amounts = [_money(tok) for tok in MONEY_TOKEN.findall(text) if tok.startswith("$")]
    if not amounts:
        raise DescParseError(f"cost has neither a table nor a stated amount: {text!r}")
    return {"previous_usd": 0, "by_year": {}, "total_usd": amounts[0], "sums_match": None, "note": text}


def stated_miles(text: str) -> float | None:
    found = MILES.search(text)
    return float(found.group(1)) if found else None


def build_window(cost: dict | None, in_service: str) -> tuple[str | None, str | None, bool]:
    """(window_start, window_end, started_before_list)."""
    if not cost or not cost["by_year"]:
        return None, None, False
    years = sorted(cost["by_year"])
    started_before = cost["previous_usd"] > 0
    spend_years = [y for y in years if cost["by_year"][y] > 0]
    first = years[0] if started_before or not spend_years else spend_years[0]
    first = min(first, in_service[:4])
    return f"{first}-01-01", in_service, started_before


def voltage_kv(title: str) -> int | None:
    found = [float(n) for m in VOLTAGE.finditer(title) for n in m.groups() if n]
    return int(max(found)) if found else None


def work_type(title: str) -> str:
    lowered = title.lower()
    return next((kind for word, kind in WORK_TYPES if word in lowered), "other")


def endpoint_names(title: str) -> list[str]:
    """Facility names from a DESC title: 'Hooks - Thurmond 115 kV Tie: Rebuild' -> ['Hooks', 'Thurmond']."""
    head = re.split(r"[:/,&(]", title)[0]
    head = re.split(r"\s\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*kV", head, flags=re.IGNORECASE)[0]
    head = re.sub(r"\s*\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*kV.*$", "", head, flags=re.IGNORECASE)
    parts = re.split(r"\s*[-–]\s*", head)
    return [p.strip() for p in parts if p.strip() and not re.fullmatch(r"[\d.]+", p.strip())]


def _joined(lines: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def parse_page(text: str, page: int, source_id: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    sections = _sections(lines)
    missing = [h for h in HEADERS if h not in sections]
    if missing:
        raise DescParseError(f"{source_id} p.{page}: missing {missing}")

    name = _title(lines)
    project_id_raw = _joined(sections["Project ID"])
    date_raw = _joined(sections["Planned In-Service Date"])
    in_service, date_quirk = parse_desc_date(date_raw)
    cost = parse_cost_lines(sections["Estimated Project Cost"])
    window_start, window_end, started_before = build_window(cost, in_service)
    description = _joined(sections["Project Description"])
    need = _joined(sections["Project Need"])
    status = _joined(sections["Project Status"])

    def cite(field: str, quote: str) -> dict:
        return {"field": field, "quote": quote, "page": page, "source_id": source_id}

    return {
        "id": f"{source_id}-{normalize_project_id(project_id_raw)}",
        "utility": "DESC",
        "sponsor_raw": "DESC",
        "source_id": source_id,
        "page": page,
        "project_id_raw": project_id_raw,
        "name": name,
        "description": description,
        "need_text": need,
        "status": status,
        "in_service_date": in_service,
        "date_precision": "day",
        "date_quirk": date_quirk,
        "window_start": window_start,
        "window_end": window_end,
        "window_method": "desc_cost_schedule",
        "started_before_list": started_before,
        "voltage_kv": voltage_kv(name),
        "work_type": work_type(name),
        "endpoint_names": endpoint_names(name),
        "line_miles": stated_miles(name) or stated_miles(description),
        "cost_public": cost,
        "change_notes": None,
        "evidence": [
            cite("name", name),
            cite("project_id", project_id_raw),
            cite("description", description),
            cite("need", need),
            cite("status", status),
            cite("in_service_date", date_raw),
            cite("cost_total", f"${cost['total_usd']:,}"),
        ],
    }


def _unique_ids(projects: list[dict]) -> list[dict]:
    """The source occasionally reuses a Project ID for a different project; later pages get a suffix."""
    first_page: dict[str, int] = {}
    result = []
    for p in projects:
        if p["id"] in first_page:
            quirk = f"Project ID {p['project_id_raw']} also used on p.{first_page[p['id']]}"
            p = {**p, "id": f"{p['id']}-p{p['page']}", "id_quirk": quirk}
        else:
            first_page[p["id"]] = p["page"]
            p = {**p, "id_quirk": None}
        result.append(p)
    return result


def parse_pdf(path: Path, source_id: str) -> list[dict]:
    with pymupdf.open(path) as doc:
        projects = _unique_ids([parse_page(page.get_text(), i + 1, source_id) for i, page in enumerate(doc)])
    expected = EXPECTED_COUNTS.get(source_id)
    if expected is not None and len(projects) != expected:
        raise DescParseError(f"{source_id}: expected {expected} projects, parsed {len(projects)}")
    return projects
