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
