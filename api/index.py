"""Vercel serverless entry point: exposes the FastAPI app (routes live under /api)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "backend")]

from app.main import app  # noqa: E402

__all__ = ["app"]
