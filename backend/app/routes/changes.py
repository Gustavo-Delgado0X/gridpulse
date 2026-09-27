"""GET /changes: plan-change events across DESC list versions, GPC IRP tables and SERTP."""
from typing import Literal

from fastapi import APIRouter

from app.repository import get_repository
from app.schemas import ok

router = APIRouter()


@router.get("/changes")
def changes(utility: Literal["DESC", "GPC"] | None = None, event: str | None = None) -> dict:
    items = get_repository().changes
    if utility:
        items = [c for c in items if c["utility"] == utility]
    if event:
        items = [c for c in items if c["event"] == event]
    return ok(items, count=len(items))
