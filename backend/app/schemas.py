"""Response envelope and shared response models (contracts §3)."""
from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str


class Envelope(BaseModel):
    data: Any = None
    error: ErrorBody | None = None
    meta: dict[str, Any] = {}


def ok(data: Any, **meta: Any) -> dict[str, Any]:
    return Envelope(data=data, meta=meta).model_dump()


def fail(code: str, message: str) -> dict[str, Any]:
    return Envelope(error=ErrorBody(code=code, message=message)).model_dump()
