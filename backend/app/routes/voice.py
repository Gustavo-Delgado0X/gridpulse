"""GET /voice/session: a signed URL for one conversation with the GridPulse voice agent (ElevenLabs)."""
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app import voice
from app.limits import limiter
from app.schemas import ok

router = APIRouter()
SESSION_RATE_LIMIT = "5/minute"  # each session is billed by ElevenLabs


@router.get("/voice/session")
@limiter.limit(SESSION_RATE_LIMIT)
def session(request: Request) -> JSONResponse:
    try:
        url = voice.signed_session_url()
    except voice.VoiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None
    except HTTPError as exc:
        reason = voice.upstream_reason(exc.read())
        status = f"{exc.code}: {reason}" if reason else str(exc.code)
        raise HTTPException(status_code=502, detail=f"voice service error ({status})") from None
    except (URLError, TimeoutError):
        raise HTTPException(status_code=504, detail="voice service unreachable") from None
    return JSONResponse(ok({"signed_url": url}), headers={"Cache-Control": "no-store"})
