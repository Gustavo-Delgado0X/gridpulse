"""Parse SERTP preliminary expansion plans (non-CEII public copies) for the change view.

Each project block reads: "In-Service Year: YYYY / Project Name: ... / Description: ...". Only the
year, name, description and page are kept; they are used to cross-check GPC IRP need dates.
"""
import re
from pathlib import Path

import pymupdf

YEAR = re.compile(r"^(19|20)\d{2}$")
STOP = ("Description:", "Supporting", "In-Service", "Project Name:")


def _collect(lines: list[str], start: int) -> tuple[str, int]:
    parts, i = [], start
    while i < len(lines) and not lines[i].startswith(STOP):
        parts.append(lines[i])
        i += 1
    return re.sub(r"\s+", " ", " ".join(parts)).strip(), i


def parse_sertp_text(text: str, page: int) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    entries, i, year = [], 0, None
    while i < len(lines):
        line = lines[i]
        if line == "Year:" and i + 1 < len(lines) and YEAR.match(lines[i + 1]):
            year, i = int(lines[i + 1]), i + 2
            continue
        if line.startswith("Project Name:") and year is not None:
            name, i = _collect(lines, i + 1)
            description = ""
            if i < len(lines) and lines[i].startswith("Description:"):
                description, i = _collect(lines, i + 1)
            entries.append({"year": year, "name": name, "description": description, "page": page})
            year = None
            continue
        i += 1
    return entries


def parse_sertp(path: Path) -> list[dict]:
    with pymupdf.open(path) as doc:
        return [e for n, page in enumerate(doc, start=1) for e in parse_sertp_text(page.get_text(), n)]
