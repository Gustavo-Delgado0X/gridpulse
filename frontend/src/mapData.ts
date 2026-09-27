// Pure GeoJSON builders for the map (unit-testable without WebGL).
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { LatLon, Method, Opportunity, Project } from "./types";

export const STUDY_AREA = { south: 31.9, north: 34.3, west: -83.2, east: -80.6 };

const lonLat = ([lat, lon]: LatLon): [number, number] => [lon, lat];

export function projectLines(projects: Project[], focus: ReadonlySet<string> = new Set()): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const p of projects) {
    const pts = p.endpoints.filter((e) => e.lat != null && e.lon != null).map((e) => [e.lon!, e.lat!] as [number, number]);
    if (pts.length >= 2) {
      features.push({ type: "Feature", properties: { id: p.id, utility: p.utility, name: p.name, focus: focus.has(p.id) },
        geometry: { type: "LineString", coordinates: pts } });
    }
  }
  return { type: "FeatureCollection", features };
}

export function projectPoints(projects: Project[], focus: ReadonlySet<string> = new Set()): FeatureCollection<Point> {
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const p of projects) {
    for (const e of p.endpoints) {
      if (e.lat == null || e.lon == null) continue;
      const key = `${p.utility}:${e.id}:${focus.has(p.id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push({ type: "Feature", properties: { id: e.id, project: p.id, utility: p.utility, precision: e.precision, name: e.name_raw,
        focus: focus.has(p.id) },
        geometry: { type: "Point", coordinates: [e.lon, e.lat] } });
    }
  }
  return { type: "FeatureCollection", features };
}

export function overlapEnds(o: Opportunity, method: Method): [LatLon, LatLon] {
  return method === "center" ? o.centers : o.closest_points;
}

const mix = (a: LatLon, b: LatLon, t: number): [number, number] => [a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t];

/** Overlap lines, interpolated between two methods (t = 0 -> from, 1 -> to) for the Centers <-> Closest slide. */
export function overlapLines(items: Opportunity[], from: Method, to: Method, t: number, selectedId: string | null,
                             hoveredId: string | null = null): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: items.map((o) => {
      const [a0, b0] = overlapEnds(o, from);
      const [a1, b1] = overlapEnds(o, to);
      return { type: "Feature", id: o.rank, properties: { id: o.id, tier: o.tier ?? "none", touching: o.touching, selected: o.id === selectedId,
                                          hovered: o.id === hoveredId, focus: o.id === selectedId || o.id === hoveredId },
        geometry: { type: "LineString", coordinates: [mix(a0, a1, t), mix(b0, b1, t)] } };
    }),
  };
}

export function touchPoints(items: Opportunity[], method: Method): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: items.filter((o) => o.touching && method === "closest").map((o) => ({
      type: "Feature", properties: { id: o.id }, geometry: { type: "Point", coordinates: lonLat(o.closest_points[0]) } })),
  };
}

export function pairBounds(o: Opportunity, projects: Map<string, Project>): [[number, number], [number, number]] | null {
  const pts = [o.a.id, o.b.id].flatMap((id) => projects.get(id)?.endpoints ?? [])
    .filter((e) => e.lat != null && e.lon != null).map((e) => [e.lon!, e.lat!]);
  pts.push(...o.closest_points.map(lonLat), ...o.centers.map(lonLat));
  if (!pts.length) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

export function studyAreaOutline(): FeatureCollection<LineString> {
  const { south, north, west, east } = STUDY_AREA;
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString",
    coordinates: [[west, south], [east, south], [east, north], [west, north], [west, south]] } }] };
}

/** Bounds of every overlap's end points: the region overview shown on load and by "Fit all". */
export function allBounds(items: Opportunity[]): [[number, number], [number, number]] | null {
  const pts = items.flatMap((o) => [...o.closest_points, ...o.centers].map(lonLat));
  if (!pts.length) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

/** Reference places for the schematic map (approximate city centres; orientation only). */
export const PLACES: { name: string; lat: number; lon: number; kind: "state" | "city" }[] = [
  { name: "SOUTH CAROLINA", lat: 32.95, lon: -81.05, kind: "state" },
  { name: "GEORGIA", lat: 32.7, lon: -81.95, kind: "state" },
  { name: "Savannah", lat: 32.08, lon: -81.09, kind: "city" },
  { name: "Augusta", lat: 33.47, lon: -81.97, kind: "city" },
  { name: "Charleston", lat: 32.78, lon: -79.93, kind: "city" },
  { name: "Columbia", lat: 34.0, lon: -81.03, kind: "city" },
  { name: "Beaufort", lat: 32.43, lon: -80.67, kind: "city" },
];

/** Dashed connector for the selected pair: between closest points, or centers in center mode, with a pill label. */
export function connector(o: Opportunity, method: Method): { line: Feature<LineString>; mid: [number, number]; label: string } {
  const [a, b] = overlapEnds(o, method);
  const touching = method === "closest" && o.touching;
  return {
    line: { type: "Feature", properties: { id: o.id }, geometry: { type: "LineString", coordinates: [lonLat(a), lonLat(b)] } },
    mid: [(a[1] + b[1]) / 2, (a[0] + b[0]) / 2],
    label: touching ? "touching" : `${(method === "center" ? o.dist_center_mi : o.dist_closest_mi).toFixed(2)} mi`,
  };
}
