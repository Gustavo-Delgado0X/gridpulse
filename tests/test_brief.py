"""Printable one-page brief (contracts §3, §6.6 Brief)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
THURMOND = "desc-2428-6810-a__gpc-20793"


def test_brief_is_printable_html_with_facts_and_review_tag():
    res = client.get(f"/api/opportunities/{THURMOND}/brief")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    html = res.text
    assert "CANDIDATE FOR HUMAN REVIEW" in html
    assert "Hooks - Thurmond 115kV Tie: Rebuild" in html
    assert "T1 · MUST COORDINATE" in html
    assert "ROUGH ESTIMATE" in html
    assert "redacted in public filing" in html
    assert "P.31" in html
    assert "@media print" in html


def test_brief_escapes_source_text():
    res = client.get(f"/api/opportunities/{THURMOND}/brief")

    assert "<script" not in res.text.lower()


def test_brief_unknown_id_is_404_envelope():
    res = client.get("/api/opportunities/nope/brief")

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_brief_uses_estimator_overrides_from_query():
    res = client.get(f"/api/opportunities/{THURMOND}/brief?shared_corridor_mi=2&row_width_ft=100&usd_per_acre=5000"
                     "&mobilization_usd=250000&avoided_mobilizations=2")

    assert "2.0 mi" in res.text
    assert "$621,212" in res.text  # 2*5280*100/43560 = 24.24 acres * $5,000 + $500,000


def test_brief_rejects_negative_estimator_input():
    res = client.get(f"/api/opportunities/{THURMOND}/brief?shared_corridor_mi=-1")

    assert res.status_code == 400


def test_brief_print_button_does_not_cover_header():
    html = client.get(f"/api/opportunities/{THURMOND}/brief").text

    assert "position: fixed" not in html
