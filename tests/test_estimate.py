"""Cost/impact estimator (contracts §2.8): transparent formula, labelled assumptions."""
import pytest

from engine.estimate import default_inputs, estimate

DESC = {"voltage_kv": 230, "line_miles": 18.0, "cost_public": {"total_usd": 11_116_933}, "utility": "DESC"}
GPC = {"voltage_kv": 115, "line_miles": None, "cost_public": None, "utility": "GPC"}


def test_defaults_use_higher_voltage_row_width_and_known_miles():
    inputs = default_inputs(DESC, GPC, dist_closest_mi=2.0)

    assert inputs["row_width_ft"] == 125  # 230 kV assumption
    assert inputs["shared_corridor_mi"] == 0.0  # no source says the corridors are shared
    assert inputs["avoided_mobilizations"] == 0  # no evidence of an avoided mobilization either
    assert {a["key"] for a in inputs["assumptions"]} >= {"row_width_ft", "mobilization_usd", "usd_per_acre"}


def test_estimate_formula():
    result = estimate({"shared_corridor_mi": 2.0, "row_width_ft": 100, "usd_per_acre": 5000,
                       "mobilization_usd": 250_000, "avoided_mobilizations": 2})

    assert result["shared_row_acres"] == pytest.approx(2 * 5280 * 100 / 43560)
    assert result["land_value_usd"] == pytest.approx(result["shared_row_acres"] * 5000)
    assert result["mobilization_saved_usd"] == 500_000
    assert result["total_usd"] == pytest.approx(result["land_value_usd"] + 500_000)
    assert result["label"] == "ROUGH ESTIMATE FOR DISCUSSION"
    assert "43,560" in result["formula"]


def test_estimate_rejects_negative_inputs():
    with pytest.raises(ValueError):
        estimate({"shared_corridor_mi": -1, "row_width_ft": 100, "usd_per_acre": 1, "mobilization_usd": 1,
                  "avoided_mobilizations": 1})


def test_shared_corridor_is_never_assumed_but_stated_lengths_are_reported():
    inputs = default_inputs({**DESC, "line_miles": 18.0}, {**GPC, "line_miles": None}, dist_closest_mi=2.0)

    assert inputs["shared_corridor_mi"] == 0.0
    assert inputs["corridor_source"] == ("No source states a shared corridor; enter one to explore. "
                                         "Stated line lengths: DESC 18.0 mi, GPC not stated.")
