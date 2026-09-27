"""Voice agent session: the server exchanges its ElevenLabs key for a short-lived signed conversation URL."""
import io
import json
import urllib.error

from fastapi.testclient import TestClient

from app import voice
from app.main import app

client = TestClient(app)
SIGNED = "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_x&conversation_signature=sig"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_) -> None:
        self.close()


def configure(monkeypatch, key: str | None = "test-key-123", agent: str | None = "agent_abc123"):
    for name, value in (("ELEVENLABS_API_KEY", key), ("ELEVENLABS_AGENT_ID", agent)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)


def test_session_returns_a_signed_url_and_never_the_key(monkeypatch):
    seen = []

    def fake_urlopen(request, timeout):
        seen.append({"url": request.full_url, "headers": dict(request.header_items())})
        return FakeResponse(json.dumps({"signed_url": SIGNED}).encode())

    configure(monkeypatch)
    monkeypatch.setattr(voice, "urlopen", fake_urlopen)

    res = client.get("/api/voice/session")

    assert res.status_code == 200
    assert res.json()["data"] == {"signed_url": SIGNED}
    assert res.headers["cache-control"] == "no-store"
    assert "test-key-123" not in res.text
    [call] = seen
    assert call["url"] == "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=agent_abc123"
    assert call["headers"]["Xi-api-key"] == "test-key-123"


def test_session_without_key_or_agent_is_503(monkeypatch):
    configure(monkeypatch, key=None)
    assert client.get("/api/voice/session").status_code == 503
    configure(monkeypatch, agent=None)
    res = client.get("/api/voice/session")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "unavailable"


def test_session_upstream_error_is_502_with_reason(monkeypatch):
    def failing(request, timeout):
        body = b'{"detail":{"status":"missing_permissions","message":"no convai_write for test-key-123"}}'
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, io.BytesIO(body))

    configure(monkeypatch)
    monkeypatch.setattr(voice, "urlopen", failing)

    res = client.get("/api/voice/session")

    assert res.status_code == 502
    assert res.json()["error"]["message"] == "voice service error (401: missing_permissions)"
    assert "test-key-123" not in res.text


def test_agent_id_must_look_like_an_agent_id(monkeypatch):
    configure(monkeypatch, agent="../../evil?x=1")
    assert client.get("/api/voice/session").status_code == 503


def test_health_reports_agent_availability(monkeypatch):
    configure(monkeypatch)
    assert client.get("/api/health").json()["data"]["agent"] == "available"
    configure(monkeypatch, agent=None)
    assert client.get("/api/health").json()["data"]["agent"] == "unavailable"
