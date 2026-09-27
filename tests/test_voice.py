"""Voice briefing (ElevenLabs): a spoken script built only from verified data, and a server-side TTS proxy."""
import io
import json
import urllib.error

import pytest
from fastapi.testclient import TestClient

from app import voice
from app.main import app
from app.repository import get_repository
from app.routes.opportunities import detail

THURMOND = "desc-2428-6810-a__gpc-20793"
GOSHEN = "desc-2428-6367-d-g__gpc-20065"
FAKE_MP3 = b"ID3\x04fake-mp3-bytes"

client = TestClient(app)


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_) -> None:
        self.close()


@pytest.fixture(autouse=True)
def fresh_cache():
    voice.clear_cache()
    yield
    voice.clear_cache()


@pytest.fixture
def calls(monkeypatch):
    """Configure a fake key and capture every request sent to ElevenLabs."""
    seen: list = []

    def fake_urlopen(request, timeout):
        seen.append({"url": request.full_url, "headers": dict(request.header_items()),
                     "body": json.loads(request.data), "timeout": timeout})
        return FakeResponse(FAKE_MP3)

    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-123")
    monkeypatch.setattr(voice, "urlopen", fake_urlopen)
    return seen


def test_script_speaks_only_verified_facts_for_a_touching_pair():
    text = voice.brief_script(detail(get_repository(), THURMOND))

    assert "Pair 1" in text and "Tier T1" in text and "must coordinate" in text
    assert "shared facility" in text
    assert "4.09 miles" in text  # center-to-center, Sperry's method
    assert "page 31" in text and "page 189" in text  # each in-service (need) date is cited
    assert text.rstrip().endswith("a candidate for human review, not a decision.")
    assert "REDACTED" not in text and len(text) < voice.MAX_CHARS


def test_script_reports_closest_distance_and_build_window_overlap():
    text = voice.brief_script(detail(get_repository(), GOSHEN))

    assert "3.04 miles" in text and "213 days" in text
    assert "Tier T3" in text


def test_script_turns_plan_shorthand_into_speakable_words():
    assert voice.speakable("EVANS PRIMARY - THURMOND DAM (USA) #5 115KV REBUILD") == \
        "EVANS PRIMARY to THURMOND DAM (USA) number 5 115 kilovolt REBUILD"
    assert voice.speakable("SAV: GOSHEN (SAV) - MCINTOSH 115KV") == "GOSHEN (SAV) to MCINTOSH 115 kilovolt"


def test_script_endpoint_returns_the_transcript():
    res = client.get(f"/api/opportunities/{THURMOND}/brief/script")

    assert res.status_code == 200
    assert res.json()["data"]["text"] == voice.brief_script(detail(get_repository(), THURMOND))


def test_audio_without_a_key_is_a_clear_503(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

    res = client.get(f"/api/opportunities/{THURMOND}/brief/audio")

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "unavailable"


def test_audio_proxies_elevenlabs_with_the_script_and_caches(calls):
    first = client.get(f"/api/opportunities/{THURMOND}/brief/audio")
    second = client.get(f"/api/opportunities/{THURMOND}/brief/audio")

    assert first.status_code == 200 and first.content == FAKE_MP3
    assert first.headers["content-type"] == "audio/mpeg"
    assert second.content == FAKE_MP3
    [call] = calls  # the second request is served from the cache
    assert call["url"].startswith(f"https://api.elevenlabs.io/v1/text-to-speech/{voice.voice_id()}")
    assert call["headers"]["Xi-api-key"] == "test-key-123"
    assert call["body"]["model_id"] == voice.model_id()
    assert call["body"]["text"] == voice.brief_script(detail(get_repository(), THURMOND))


def test_audio_upstream_error_is_a_502_that_never_leaks_the_key(monkeypatch):
    def failing(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, io.BytesIO(b"bad key test-key-123"))

    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-123")
    monkeypatch.setattr(voice, "urlopen", failing)

    res = client.get(f"/api/opportunities/{THURMOND}/brief/audio")

    assert res.status_code == 502
    assert "test-key-123" not in res.text
    assert res.json()["error"]["message"] == "voice service error (401)"


def test_audio_for_an_unknown_pair_is_404_and_never_calls_elevenlabs(calls):
    res = client.get("/api/opportunities/nope__nope/brief/audio")

    assert res.status_code == 404
    assert calls == []


def test_health_reports_whether_voice_is_configured(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    assert client.get("/api/health").json()["data"]["voice"] == "unavailable"
    monkeypatch.setenv("ELEVENLABS_API_KEY", "k")
    assert client.get("/api/health").json()["data"]["voice"] == "available"
