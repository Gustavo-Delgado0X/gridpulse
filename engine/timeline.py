"""Timeline signal (contracts §2.4): build-window overlap, in-service gap, timing label."""
import datetime as dt

Window = tuple[dt.date | None, dt.date | None]

WITHIN_ONE_YEAR_DAYS = 365
TIMING_ORDER = {"same_window": 0, "within_1y": 1, "separate": 2}


def gap_days(a: dt.date, b: dt.date) -> int:
    return abs((a - b).days)


def window_overlap_days(a: Window | None, b: Window | None) -> int | None:
    if a is None or b is None or None in a or None in b:
        return None
    start, end = max(a[0], b[0]), min(a[1], b[1])
    return max(0, (end - start).days)


def timing_label(overlap_days: int | None, gap: int) -> str:
    if overlap_days:
        return "same_window"
    if gap <= WITHIN_ONE_YEAR_DAYS:
        return "within_1y"
    return "separate"
