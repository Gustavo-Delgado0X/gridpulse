"""GET /export/overlaps.csv in Sperry's column layout (+ GridPulse columns at the end)."""
import csv
import io

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.repository import get_repository
from app.routes.opportunities import DEFAULT_D, MAX_D, MIN_D, Method, select

router = APIRouter()

UTILITY_NAMES = {"DESC": "Dominion Energy South Carolina", "GPC": "Georgia Power"}
SPERRY_COLUMNS = ["overlap_id", "distance_mi", "time_gap (day)", "utility_a", "project_id_a", "project_name_a",
                  "utility_b", "project_id_b", "project_name_b"]
EXTRA_COLUMNS = ["tier", "touching", "dist_closest_mi", "dist_center_mi", "timeline_label", "window_overlap_days",
                 "flags", "source_a", "source_b"]


def _row(o: dict, method: str) -> list:
    a, b = o["a"], o["b"]
    distance = o["dist_center_mi"] if method == "center" else o["dist_closest_mi"]
    return [f"OPP_{o['rank']}", round(distance, 2), o["in_service_gap_days"], UTILITY_NAMES[a["utility"]], a["id"],
            a["name"], UTILITY_NAMES[b["utility"]], b["id"], b["name"], o["tier"], o["touching"],
            o["dist_closest_mi"], o["dist_center_mi"], o["timeline_label"], o["window_overlap_days"],
            "|".join(o["flags"]), f"{a['source_id']} p.{a['page']}", f"{b['source_id']} p.{b['page']}"]


@router.get("/export/overlaps.csv")
def overlaps_csv(d: float = Query(DEFAULT_D, ge=MIN_D, le=MAX_D), method: Method = "closest") -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(SPERRY_COLUMNS + EXTRA_COLUMNS)
    writer.writerows(_row(o, method) for o in select(get_repository(), d, method))
    return Response(buffer.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="gridpulse_overlaps.csv"'})
