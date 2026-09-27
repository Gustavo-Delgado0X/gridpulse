"""Shared test paths. Tests that need source PDFs skip when data/raw is absent (it is gitignored)."""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
STARTER = RAW / "starter"
FIXTURES = Path(__file__).parent / "fixtures"


def require(path: Path) -> Path:
    if not path.exists():
        pytest.skip(f"source file not present: {path.relative_to(ROOT)}")
    return path
