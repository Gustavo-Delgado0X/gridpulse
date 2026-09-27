"""API contract tests (contracts §3): envelope, health, read-only."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_envelope_with_status_fields():
    # Act
    res = client.get("/api/health")

    # Assert
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"data", "error", "meta"}
    assert body["error"] is None
    assert body["data"]["api"] == "ok"
    assert body["data"]["data_mode"] in {"seed", "db"}
    assert body["data"]["ai"] in {"available", "unavailable"}


def test_unknown_route_returns_error_envelope():
    res = client.get("/api/does-not-exist")

    assert res.status_code == 404
    body = res.json()
    assert body["data"] is None
    assert body["error"]["code"] == "not_found"


def test_api_is_read_only():
    res = client.post("/api/health")

    assert res.status_code == 405


THURMOND = "desc-2428-6810-a__gpc-20793"


def data(path, status=200):
    res = client.get(f"/api{path}")
    assert res.status_code == status, res.text
    return res.json()


def test_health_counts_pinned_sources():
    assert data("/health")["data"]["sources_pinned"] >= 6


def test_sources_are_pinned_by_sha256():
    sources = data("/sources")["data"]

    desc = next(s for s in sources if s["id"] == "desc-2428")
    assert desc["sha256"].startswith("890876d0faefd405")


def test_projects_filter_by_utility_and_located():
    body = data("/projects?utility=DESC&located=true")

    assert body["meta"]["count"] == len(body["data"]) > 0
    assert all(p["utility"] == "DESC" for p in body["data"])
    assert all(any(e["lat"] is not None for e in p["endpoints"]) for p in body["data"])


def test_projects_reject_unknown_utility():
    assert data("/projects?utility=XYZ", 400)["error"]["code"] == "bad_request"


def test_opportunities_default_is_closest_within_25_ranked():
    body = data("/opportunities")
    items = body["data"]

    assert body["meta"] == {"count": len(items), "d": 25.0, "method": "closest"}
    assert items[0]["id"] == THURMOND and items[0]["tier"] == "T1"
    assert [o["rank"] for o in items] == list(range(1, len(items) + 1))
    assert all(o["touching"] or o["dist_closest_mi"] <= 25 for o in items)
    assert items[0]["a"]["utility"] == "DESC" and items[0]["b"]["utility"] == "GPC"
    assert items[0]["a"]["name"].startswith("Hooks - Thurmond")


def test_opportunities_filters():
    t1 = data("/opportunities?tier=T1")["data"]
    near = data("/opportunities?d=5")["data"]
    center = data("/opportunities?method=center")["data"]

    assert t1 and all(o["tier"] == "T1" for o in t1)
    assert all(o["touching"] or o["dist_closest_mi"] <= 5 for o in near)
    assert all(o["dist_center_mi"] < 25 for o in center)


def test_opportunities_timeline_filter():
    same = data("/opportunities?timeline=same_window")["data"]

    assert same and all(o["timeline_label"] == "same_window" for o in same)


def test_opportunities_reject_out_of_bounds_distance():
    assert data("/opportunities?d=80", 400)["error"]["code"] == "bad_request"
    assert data("/opportunities?method=bogus", 400)["error"]["code"] == "bad_request"


def test_opportunity_detail_has_projects_evidence_and_estimator():
    detail = data(f"/opportunities/{THURMOND}")["data"]

    assert detail["project_a"]["id"] == "desc-2428-6810-a"
    assert {e["type"] for e in detail["evidence"]} >= {"fact", "derived", "interpretation"}
    assert any(e["type"] == "fact" and e["page"] for e in detail["evidence"])
    assert detail["estimator"]["inputs"]["row_width_ft"] == 100
    assert detail["estimator"]["result"]["label"] == "ROUGH ESTIMATE FOR DISCUSSION"
    assert detail["maps_links"]["a"].startswith("https://www.google.com/maps")


def test_unknown_opportunity_is_404():
    assert data("/opportunities/nope__nada", 404)["error"]["code"] == "not_found"


def test_quality_reports_acceptance_and_coverage():
    quality = data("/quality")["data"]

    assert quality["acceptance"]["passed"] is True
    assert quality["coverage"]["projects"] > 100
    assert any(d["kind"] == "coordinate_conflict" for d in quality["discrepancies"])


def test_export_csv_uses_sperry_columns_first():
    res = client.get("/api/export/overlaps.csv")

    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    header, first = res.text.splitlines()[:2]
    assert header.startswith("overlap_id,distance_mi,time_gap (day),utility_a,project_id_a,project_name_a,"
                             "utility_b,project_id_b,project_name_b,")
    assert first.startswith("OPP_1,")


def test_changes_filter_by_event():
    body = data("/changes?event=sources_disagree&utility=GPC")

    assert body["meta"]["count"] == len(body["data"]) > 0
    assert all(c["event"] == "sources_disagree" and c["utility"] == "GPC" for c in body["data"])
