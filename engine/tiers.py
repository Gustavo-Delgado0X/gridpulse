"""Candidate gate and tiers T1-T4 (contracts §2.3)."""
DEFAULT_MAX_MILES = 25.0
T2_MAX_MILES = 1.0
T3_MAX_MILES = 5.0
T4_MAX_MILES = 25.0

TIER_LABELS = {
    "T1": "MUST COORDINATE",
    "T2": "SHARE LAND",
    "T3": "SHARE LOGISTICS",
    "T4": "SHARE CREWS",
}


def tier_for(touching: bool, miles: float | None) -> str | None:
    if touching or miles == 0:
        return "T1"
    if miles is None:
        return None
    if miles < T2_MAX_MILES:
        return "T2"
    if miles < T3_MAX_MILES:
        return "T3"
    if miles <= T4_MAX_MILES:
        return "T4"
    return None


def passes_gate(utility_a: str, utility_b: str, touching: bool, miles: float | None,
                max_miles: float = DEFAULT_MAX_MILES) -> bool:
    if utility_a == utility_b:
        return False
    if touching:
        return True
    return miles is not None and miles <= max_miles
