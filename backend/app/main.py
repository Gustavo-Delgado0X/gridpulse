"""FastAPI app: CORS, {data,error,meta} envelope, health (contracts §3)."""
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.repository import get_repository
from app.routes import changes, export, opportunities, projects, sources
from app.schemas import fail, ok

API_PREFIX = "/api"
ERROR_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 429: "rate_limited",
               503: "unavailable"}
RATE_LIMIT = os.environ.get("RATE_LIMIT", "120/minute")

app = FastAPI(title="GridPulse API", version="0.1.0", docs_url=f"{API_PREFIX}/docs",
              openapi_url=f"{API_PREFIX}/openapi.json")

app.state.limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = ERROR_CODES.get(exc.status_code, "error")
    message = exc.detail if isinstance(exc.detail, str) else code
    return JSONResponse(fail(code, message), status_code=exc.status_code)


@app.exception_handler(RateLimitExceeded)
async def rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(fail("rate_limited", f"rate limit exceeded: {exc.detail}"), status_code=429)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []))
    return JSONResponse(fail("bad_request", f"{loc}: {first.get('msg', 'invalid')}"), status_code=400)


@app.get(f"{API_PREFIX}/health")
def health() -> dict:
    ai = "available" if os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GOOGLE_API_KEY") else "unavailable"
    return ok({"api": "ok", "data_mode": os.environ.get("DATA_MODE", "seed"), "ai": ai,
               "sources_pinned": sum(1 for s in get_repository().sources if s.get("sha256"))})


for module in (sources, projects, opportunities, changes, export):
    app.include_router(module.router, prefix=API_PREFIX)
