"""Evidence list and template explanation for one opportunity (contracts §3, §5 U5)."""
from engine.tiers import TIER_LABELS

TIMING_TEXT = {
    "same_window": "their published build windows overlap",
    "within_1y": "their in-service dates are within a year of each other",
    "separate": "their timing is separate",
}


def _facts(project: dict, side: str) -> list[dict]:
    return [
        {"id": f"{side}.{e['field']}", "type": "fact", "label": f"FACT · P.{e['page']}", "field": e["field"],
         "quote": e["quote"], "page": e["page"], "source_id": e["source_id"], "project_id": project["id"]}
        for e in project.get("evidence", [])
        if e["field"] in {"name", "description", "need_date", "in_service_date", "start_date", "cost_total", "status"}
    ]


def _derived(opportunity: dict) -> list[dict]:
    closest = "touching (shared facility)" if opportunity["touching"] else f"{opportunity['dist_closest_mi']:.2f} mi"
    return [
        {"id": "derived.closest", "type": "derived", "label": "DERIVED · CLOSEST-POINT",
         "quote": f"Closest-point distance {closest} (geodesic, WGS84)"},
        {"id": "derived.center", "type": "derived", "label": "DERIVED · CENTER HAVERSINE",
         "quote": f"Center-to-center {opportunity['dist_center_mi']:.2f} mi (Sperry method, R = 3958.8 mi)"},
        {"id": "derived.gap", "type": "derived", "label": "DERIVED · DATE GAP",
         "quote": f"In-service dates {opportunity['in_service_gap_days']} days apart"
                  + (f"; build windows overlap {opportunity['window_overlap_days']} days"
                     if opportunity.get("window_overlap_days") else "")},
    ]


def template_explanation(opportunity: dict, a: dict, b: dict) -> str:
    tier = opportunity["tier"]
    where = "share a facility" if opportunity["touching"] else f"come within {opportunity['dist_closest_mi']:.1f} mi"
    return (f"{a['utility']} '{a['name']}' and {b['utility']} '{b['name']}' {where}; "
            f"{TIMING_TEXT[opportunity['timeline_label']]}. Tier {tier} · {TIER_LABELS[tier].lower()}. "
            "Candidate for human review.")


def build_evidence(opportunity: dict, a: dict, b: dict) -> list[dict]:
    interpretation = {"id": "interpretation.template", "type": "interpretation", "label": "TEMPLATE",
                      "quote": template_explanation(opportunity, a, b)}
    return [*_facts(a, "a"), *_facts(b, "b"), *_derived(opportunity), interpretation]
