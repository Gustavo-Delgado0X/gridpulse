"""Cost/impact estimator, the bonus criterion (contracts §2.8).

Every input is shown and editable. Defaults are team assumptions, labelled as such, not utility data.
"""
SQFT_PER_ACRE = 43_560
FEET_PER_MILE = 5_280
# Right-of-way widths by voltage: team assumptions for illustration, not sourced from either utility.
ROW_WIDTH_FT = {69: 75, 115: 100, 230: 125, 500: 175}
DEFAULT_MOBILIZATION_USD = 250_000
DEFAULT_USD_PER_ACRE = 5_000
LABEL = "ROUGH ESTIMATE FOR DISCUSSION"
NUMERIC_INPUTS = ("shared_corridor_mi", "row_width_ft", "usd_per_acre", "mobilization_usd", "avoided_mobilizations")

ASSUMPTIONS = [
    {"key": "row_width_ft", "text": "Right-of-way width by voltage (69 kV 75 ft, 115 kV 100 ft, 230 kV 125 ft, "
                                    "500 kV 175 ft): team assumption"},
    {"key": "mobilization_usd", "text": "$250,000 per avoided crew/equipment mobilization: team assumption"},
    {"key": "usd_per_acre", "text": "$5,000 per acre of right-of-way: team assumption"},
    {"key": "shared_corridor_mi", "text": "Shared corridor: 0 by default. No source states that two projects share a "
                                          "corridor; enter a length to explore the arithmetic"},
]


def row_width_for(voltage_kv: int | None) -> int:
    if not voltage_kv:
        return ROW_WIDTH_FT[115]
    eligible = [kv for kv in ROW_WIDTH_FT if kv <= voltage_kv]
    return ROW_WIDTH_FT[max(eligible)] if eligible else ROW_WIDTH_FT[69]


def default_inputs(project_a: dict, project_b: dict, dist_closest_mi: float) -> dict:
    voltages = [p.get("voltage_kv") for p in (project_a, project_b) if p.get("voltage_kv")]
    stated = ", ".join(f"{p['utility']} {p['line_miles']:.1f} mi" if p.get("line_miles") is not None
                       else f"{p['utility']} not stated" for p in (project_a, project_b))
    return {
        "shared_corridor_mi": 0.0,
        "corridor_source": f"No source states a shared corridor; enter one to explore. Stated line lengths: {stated}.",
        "row_width_ft": row_width_for(max(voltages) if voltages else None),
        "usd_per_acre": DEFAULT_USD_PER_ACRE,
        "mobilization_usd": DEFAULT_MOBILIZATION_USD,
        "avoided_mobilizations": 1,
        "assumptions": ASSUMPTIONS,
        "cost_context": [
            {"utility": p["utility"], "total_usd": (p.get("cost_public") or {}).get("total_usd"),
             "note": None if p.get("cost_public") else "redacted in public filing"}
            for p in (project_a, project_b)
        ],
    }


def estimate(inputs: dict) -> dict:
    values = {k: float(inputs[k]) for k in NUMERIC_INPUTS}
    if any(v < 0 for v in values.values()):
        raise ValueError("estimator inputs must be non-negative")
    acres = values["shared_corridor_mi"] * FEET_PER_MILE * values["row_width_ft"] / SQFT_PER_ACRE
    land = acres * values["usd_per_acre"]
    mobilization = values["mobilization_usd"] * values["avoided_mobilizations"]
    return {
        "shared_row_acres": acres,
        "land_value_usd": land,
        "mobilization_saved_usd": mobilization,
        "total_usd": land + mobilization,
        "formula": "acres = miles × 5,280 × ROW ft ÷ 43,560; value = acres × $/acre + mobilization × avoided",
        "label": LABEL,
    }
