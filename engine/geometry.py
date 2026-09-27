"""Project geometry (contracts §2.1): OSM line, straight endpoint segment, or single point.

Inputs are (lat, lon) tuples in WGS84. Geometries are returned in EPSG:5070 (CONUS Albers, metres)
so Shapely can find nearest points; distances themselves are measured geodesically (engine.distance).
"""
from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.geometry.base import BaseGeometry

LatLon = tuple[float, float]

_TO_ALBERS = Transformer.from_crs("EPSG:4326", "EPSG:5070", always_xy=True)
_TO_WGS84 = Transformer.from_crs("EPSG:5070", "EPSG:4326", always_xy=True)


def project(point: LatLon) -> tuple[float, float]:
    lat, lon = point
    return _TO_ALBERS.transform(lon, lat)


def unproject(xy: tuple[float, float]) -> LatLon:
    lon, lat = _TO_WGS84.transform(xy[0], xy[1])
    return (lat, lon)


def center_point(points: list[LatLon]) -> LatLon | None:
    """Sperry's center: midpoint of the two endpoints, or the single located endpoint."""
    if not points:
        return None
    return (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points))


def build_geometry(points: list[LatLon], line: list[LatLon] | None = None) -> BaseGeometry | None:
    if line and len(line) >= 2:
        return LineString([project(p) for p in line])
    unique = list(dict.fromkeys(points))
    if len(unique) >= 2:
        return LineString([project(p) for p in unique])
    if len(unique) == 1:
        return Point(project(unique[0]))
    return None
