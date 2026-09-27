"""Contract between frontend/src/api.ts + types.ts and the FastAPI backend.

Every URL template the frontend builds must be served, and every non-optional field a TypeScript interface declares
must be present in the corresponding API response, so UI copy can never read a field the API does not send.
"""
import re

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import ROOT

client = TestClient(app)
API_TS = (ROOT / "frontend" / "src" / "api.ts").read_text()
TYPES_TS = (ROOT / "frontend" / "src" / "types.ts").read_text()
PAIR = "desc-2428-6367-d-g__gpc-20065"


def templates() -> list[str]:
    """Path templates used by api.ts, e.g. '/opportunities?d=${q.d}&method=${q.method}'."""
    found = re.findall(r'get<[^>]+>\(\s*[`"]([^`"]+)[`"]', API_TS)
    found += re.findall(r"\$\{API_BASE\}(/[^`]+)`", API_TS)
    return sorted(set(found))


def concrete(template: str, d: str, method: str) -> str:
    return (template.replace("${q.d}", d).replace("${q.method}", method).replace("${method}", method)
            .replace("${encodeURIComponent(id)}", PAIR))


def required_fields(interface: str) -> set[str]:
    body = re.search(rf"export interface {interface}(?: extends \w+)? \{{(.*?)\n\}}", TYPES_TS, re.S).group(1)
    fields = set()
    for line in body.splitlines():
        m = re.match(r"\s{2}(\w+)(\??):", line)  # top-level members only (2-space indent)
        if m and not m.group(2):
            fields.add(m.group(1))
    return fields


def test_api_ts_uses_the_expected_routes():
    assert templates() == sorted([
        "/changes", "/export/overlaps.csv?d=${q.d}&method=${q.method}", "/health",
        "/opportunities/${encodeURIComponent(id)}/brief/audio?method=${method}",
        "/opportunities/${encodeURIComponent(id)}/brief/script?method=${method}",
        "/opportunities/${encodeURIComponent(id)}/brief?method=${method}",
        "/opportunities/${encodeURIComponent(id)}?method=${method}", "/opportunities?d=${q.d}&method=${q.method}",
        "/projects?located=true", "/quality", "/voice/session"])


@pytest.mark.parametrize("d", ["1", "25", "50"])
@pytest.mark.parametrize("method", ["closest", "center"])
def test_every_frontend_route_is_served(d, method):
    for template in templates():
        res = client.get("/api" + concrete(template, d, method))
        if ("/brief/audio" in template or "/voice/session" in template) and res.status_code == 503:  # no key here
            assert res.json()["error"]["code"] == "unavailable"
            continue
        if "/voice/session" in template and res.status_code == 429:  # 5 sessions/min: this test calls it 6 times
            continue
        assert res.status_code == 200, (template, res.text[:200])


def test_opportunity_fields_match_types_ts():
    data = client.get("/api/opportunities?d=25&method=closest").json()["data"]
    need = required_fields("Opportunity")
    assert data and all(need <= set(o) for o in data), need - set(data[0])
    assert required_fields("ProjectRef") <= set(data[0]["a"])


def test_detail_project_quality_change_health_fields_match_types_ts():
    detail = client.get(f"/api/opportunities/{PAIR}?method=closest").json()["data"]
    assert required_fields("OpportunityDetail") <= set(detail)
    assert required_fields("Project") <= set(detail["project_a"])
    assert required_fields("EstimatorInputs") <= set(detail["estimator"]["inputs"])
    projects = client.get("/api/projects?located=true").json()["data"]
    assert all(required_fields("Project") <= set(p) for p in projects)
    quality = client.get("/api/quality").json()["data"]
    assert required_fields("Quality") <= set(quality)
    assert all(required_fields("Discrepancy") <= set(d) for d in quality["discrepancies"])
    changes = client.get("/api/changes").json()["data"]
    assert all(required_fields("Change") <= set(c) for c in changes)
    assert required_fields("Health") <= set(client.get("/api/health").json()["data"])


def test_one_mile_radius_returns_only_pairs_within_a_mile():
    data = client.get("/api/opportunities?d=1&method=closest").json()["data"]
    assert data and all(o["touching"] or o["dist_closest_mi"] <= 1 for o in data)
    assert client.get("/api/opportunities?d=0.5").status_code == 400


def test_voice_agent_tool_names_match_the_frontend():
    import importlib.util
    spec = importlib.util.spec_from_file_location("voice_agent", ROOT / "scripts" / "voice_agent.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tools_ts = (ROOT / "frontend" / "src" / "agentTools.ts").read_text()
    declared = re.search(r"TOOL_NAMES = \[(.*?)\] as const", tools_ts, re.S).group(1)
    assert re.findall(r'"(\w+)"', declared) == module.TOOL_NAMES
