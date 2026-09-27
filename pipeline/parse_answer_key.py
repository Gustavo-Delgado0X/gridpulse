"""Parse Sperry's Projects_Overlaps.xlsx (contracts §2.6).

Dates arrive as text ("12/31/2024"), Excel serials (45809) or datetimes. Center columns are Excel
formulas, so centers are recomputed here the same way: midpoint of the two endpoints, or the single
located endpoint.
"""
import datetime as dt
import json
import sys
from pathlib import Path

import openpyxl

from pipeline.normalize import endpoint_id

EXCEL_EPOCH = dt.date(1899, 12, 30)
PROJECT_COLUMNS = ("project_id", "utility", "state", "project_name", "name_a", "lat_a", "lon_a",
                   "name_b", "lat_b", "lon_b")
UTILITY_CODES = {"Dominion Energy South Carolina": "DESC", "Georgia Power": "GPC"}


def parse_date(value: object) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, (int, float)):
        return EXCEL_EPOCH + dt.timedelta(days=int(value))
    if isinstance(value, str):
        text = value.strip()
        if text.isdigit():
            return parse_date(int(text))
        for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
            try:
                return dt.datetime.strptime(text, fmt).date()
            except ValueError:
                continue
    raise ValueError(f"unrecognized date: {value!r}")


def center_of(endpoints: list[dict]) -> list[float] | None:
    located = [(e["lat"], e["lon"]) for e in endpoints if e["lat"] is not None and e["lon"] is not None]
    if not located:
        return None
    lat = sum(p[0] for p in located) / len(located)
    lon = sum(p[1] for p in located) / len(located)
    return [lat, lon]


def _endpoint(name: object, lat: object, lon: object) -> dict:
    return {
        "name": str(name).strip() if name else None,
        "lat": float(lat) if lat is not None else None,
        "lon": float(lon) if lon is not None else None,
    }


def _project(row: dict) -> dict:
    endpoints = [_endpoint(row["name_a"], row["lat_a"], row["lon_a"]),
                 _endpoint(row["name_b"], row["lat_b"], row["lon_b"])]
    endpoints = [e for e in endpoints if e["name"]]
    return {
        "project_id": row["project_id"],
        "utility": UTILITY_CODES.get(row["utility"], row["utility"]),
        "state": row["state"],
        "project_name": row["project_name"],
        "endpoints": endpoints,
        "center": center_of(endpoints),
        "in_service_date": parse_date(row["in_service_date"]).isoformat(),
    }


def _rows(sheet) -> list[dict]:
    rows = list(sheet.iter_rows(values_only=True))
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [dict(zip(header, r, strict=False)) for r in rows[1:] if any(c is not None for c in r)]


def parse_workbook(path: Path) -> dict:
    workbook = openpyxl.load_workbook(path, data_only=False)
    projects = [_project(r) for r in _rows(workbook["projects"])]
    overlaps = [
        {
            "overlap_id": r["overlap_id"],
            "distance_mi": float(r["distance_mi"]),
            "time_gap_days": int(r["time_gap (day)"]),
            "project_id_a": r["project_id_a"],
            "project_id_b": r["project_id_b"],
        }
        for r in _rows(workbook["overlaps"])
    ]
    return {"source_id": "sperry-key", "projects": projects, "overlaps": overlaps}


def main(argv: list[str]) -> None:
    source, target = Path(argv[1]), Path(argv[2])
    target.write_text(json.dumps(parse_workbook(source), indent=2) + "\n")
    print(f"wrote {target}")


if __name__ == "__main__":
    main(sys.argv)


def to_engine_projects(key: dict) -> list[dict]:
    """Answer-key projects in the engine's project shape (Sperry coordinates, no build windows)."""
    return [
        {
            "id": p["project_id"],
            "utility": p["utility"],
            "name": p["project_name"],
            "endpoints": [
                {"id": endpoint_id(p["state"], e["name"]), "name": e["name"], "lat": e["lat"], "lon": e["lon"],
                 "precision": "sperry_provided" if e["lat"] is not None else "unresolved"}
                for e in p["endpoints"]
            ],
            "line": None,
            "in_service_date": p["in_service_date"],
            "window_start": None,
            "window_end": None,
        }
        for p in key["projects"]
    ]
