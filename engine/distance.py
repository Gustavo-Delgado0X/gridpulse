"""Distances (contracts §2.2).

- dist_center_mi: haversine between centers, R = 3958.8 mi (reproduces Sperry's answer key).
- dist_closest_mi: nearest points found on EPSG:5070 geometries, then measured on the WGS84 ellipsoid.
- shared facility: same endpoint id, or located endpoints within 0.05 mi.
"""
import math
from dataclasses import dataclass

from pyproj import Geod
from shapely.geometry.base import BaseGeometry
from shapely.ops import nearest_points

from engine.geometry import LatLon, unproject

EARTH_RADIUS_MI = 3958.8
METRES_PER_MILE = 1609.344
SHARED_FACILITY_MI = 0.05

_GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True)
class Closest:
    miles: float
    point_a: LatLon
    point_b: LatLon


def haversine_mi(a: LatLon, b: LatLon) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


def geodesic_mi(a: LatLon, b: LatLon) -> float:
    _, _, metres = _GEOD.inv(a[1], a[0], b[1], b[0])
    return abs(metres) / METRES_PER_MILE


def closest(geom_a: BaseGeometry, geom_b: BaseGeometry) -> Closest:
    near_a, near_b = nearest_points(geom_a, geom_b)
    point_a, point_b = unproject((near_a.x, near_a.y)), unproject((near_b.x, near_b.y))
    miles = 0.0 if geom_a.intersects(geom_b) else geodesic_mi(point_a, point_b)
    return Closest(miles=miles, point_a=point_a, point_b=point_b)


def _located(endpoint: dict) -> bool:
    return endpoint.get("lat") is not None and endpoint.get("lon") is not None


def shared_facility(endpoints_a: list[dict], endpoints_b: list[dict]) -> bool:
    ids_a = {e["id"] for e in endpoints_a if e.get("id")}
    if any(e.get("id") in ids_a for e in endpoints_b):
        return True
    return any(
        haversine_mi((a["lat"], a["lon"]), (b["lat"], b["lon"])) <= SHARED_FACILITY_MI
        for a in endpoints_a if _located(a)
        for b in endpoints_b if _located(b)
    )
