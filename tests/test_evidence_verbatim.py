"""Every FACT evidence quote in the processed data must appear verbatim on its cited PDF page."""
import json
import re

import pymupdf
import pytest

from tests.conftest import RAW, ROOT, STARTER, require

SOURCES = {
    "desc-2428": STARTER / "Project Listings" / "Dominion Energy" / "2024-2028-2million-and-above-project-descriptions.pdf",
    "gpc-irp25-v3": STARTER / "Project Listings" / "Georgia Power" / "2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf",
    "desc-2529": RAW / "desc_2025-2029.pdf",
    "desc-2630": RAW / "desc_2026-2030.pdf",
    "sertp-2025": RAW / "sertp_2025_preliminary_non_ceii.pdf",
    "sertp-2026": RAW / "sertp_2026_preliminary_non_ceii.pdf",
}
PROCESSED = ROOT / "data" / "processed"


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@pytest.fixture(scope="module")
def pages():
    cache = {}

    def page(source_id: str, n: int) -> str:
        if (source_id, n) not in cache:
            with pymupdf.open(require(SOURCES[source_id])) as doc:
                cache[(source_id, n)] = norm(doc[n - 1].get_text())
        return cache[(source_id, n)]
    return page


def test_project_fact_quotes_are_verbatim(pages):
    projects = json.loads((PROCESSED / "projects.json").read_text())
    misses = [(p["id"], e["field"], e["quote"]) for p in projects for e in p.get("evidence", [])
              if norm(e["quote"]) not in pages(e["source_id"], e["page"])]
    assert misses == []


def test_change_evidence_quotes_are_verbatim(pages):
    changes = json.loads((PROCESSED / "changes.json").read_text())
    misses = [(c["project_id"], c["event"], e["source_id"], e["page"], e["quote"]) for c in changes for e in c["evidence"]
              if norm(e["quote"]) not in pages(e["source_id"], e["page"])]
    assert misses == []
