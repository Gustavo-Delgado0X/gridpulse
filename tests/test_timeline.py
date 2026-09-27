"""Timeline (contracts §2.4): window overlap, in-service gap, label."""
import datetime as dt

from engine.timeline import gap_days, timing_label, window_overlap_days

D = dt.date


def test_gap_days_is_absolute():
    assert gap_days(D(2024, 12, 31), D(2033, 6, 1)) == 3074
    assert gap_days(D(2033, 6, 1), D(2024, 12, 31)) == 3074


def test_window_overlap_days_intersection():
    assert window_overlap_days((D(2024, 1, 1), D(2026, 6, 1)), (D(2025, 1, 1), D(2027, 1, 1))) == 516
    assert window_overlap_days((D(2024, 1, 1), D(2024, 6, 1)), (D(2025, 1, 1), D(2027, 1, 1))) == 0


def test_window_overlap_none_when_a_window_is_missing():
    assert window_overlap_days(None, (D(2025, 1, 1), D(2027, 1, 1))) is None
    assert window_overlap_days((None, D(2025, 1, 1)), (D(2025, 1, 1), D(2027, 1, 1))) is None


def test_timing_label_precedence():
    assert timing_label(overlap_days=10, gap=900) == "same_window"
    assert timing_label(overlap_days=0, gap=365) == "within_1y"
    assert timing_label(overlap_days=None, gap=366) == "separate"
