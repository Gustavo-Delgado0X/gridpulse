"""GET /sources, /quality."""
from fastapi import APIRouter

from app.repository import get_repository
from app.schemas import ok

router = APIRouter()


@router.get("/sources")
def sources() -> dict:
    items = get_repository().sources
    return ok(items, count=len(items))


@router.get("/quality")
def quality() -> dict:
    return ok(get_repository().quality)
