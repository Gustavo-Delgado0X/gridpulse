"""Candidate gate and tiers (contracts §2.3), boundaries exact."""
import pytest

from engine.tiers import TIER_LABELS, passes_gate, tier_for


@pytest.mark.parametrize(
    ("touching", "miles", "tier"),
    [
        (True, 12.0, "T1"),
        (False, 0.0, "T1"),
        (False, 0.5, "T2"),
        (False, 0.999, "T2"),
        (False, 1.0, "T3"),
        (False, 4.99, "T3"),
        (False, 5.0, "T4"),
        (False, 25.0, "T4"),
        (False, 25.01, None),
        (False, None, None),
    ],
)
def test_tier_boundaries(touching, miles, tier):
    assert tier_for(touching, miles) == tier


def test_gate_requires_different_utilities():
    assert not passes_gate("DESC", "DESC", touching=False, miles=1.0)
    assert passes_gate("DESC", "GPC", touching=False, miles=1.0)


def test_gate_respects_threshold_and_touching():
    assert not passes_gate("DESC", "GPC", touching=False, miles=26.0)
    assert passes_gate("DESC", "GPC", touching=False, miles=26.0, max_miles=30)
    assert passes_gate("DESC", "GPC", touching=True, miles=None)
    assert not passes_gate("DESC", "GPC", touching=False, miles=None)


def test_tier_labels_name_the_shared_resource():
    assert TIER_LABELS["T1"] == "MUST COORDINATE"
    assert TIER_LABELS["T4"] == "SHARE CREWS"


def test_tier_boundaries_do_not_move_with_the_gate():
    assert tier_for(False, 30.0) is None
