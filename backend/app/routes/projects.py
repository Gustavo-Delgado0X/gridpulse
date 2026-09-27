"""GET /projects."""
from typing import Literal

from fastapi import APIRouter

from app.repository import get_repository
from app.schemas import ok

router = APIRouter()


@router.get("/projects")
def projects(utility: Literal["DESC", "GPC", "other_utility"] | None = None, located: bool | None = None) -> dict:
    items = list(get_repository().projects.values())
    if utility:
        items = [p for p in items if p["utility"] == utility]
    if located is not None:
        items = [p for p in items if any(e.get("lat") is not None for e in p["endpoints"]) == located]
    return ok(items, count=len(items))
