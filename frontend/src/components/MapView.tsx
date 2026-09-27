import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";
import { overlapLines, pairBounds, projectLines, projectPoints, STUDY_AREA, studyAreaOutline, touchPoints } from "../mapData";
import type { Method, Opportunity, Project } from "../types";

const STATE_FIPS = new Set(["45", "13", "37", "12", "01", "47"]); // SC, GA + neighbors for context
const METHOD_MS = 300;
const FLY_MS = 600;
const USGS_IMAGERY = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";

interface Props {
  projects: Project[];
  opportunities: Opportunity[];
  selectedId: string | null;
  method: Method;
  onSelect: (id: string) => void;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function color(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function states() {
  const topo = statesTopo as unknown as Topology<{ states: GeometryCollection }>;
  const all = feature(topo, topo.objects.states);
  return { ...all, features: all.features.filter((f) => STATE_FIPS.has(String(f.id))) };
}

function squareImage(fill: string, stroke: string, hollow: boolean): ImageData {
  const size = 14;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = hollow ? "#ffffff" : fill;
  ctx.strokeStyle = hollow ? fill : stroke;
  ctx.lineWidth = 2;
  ctx.fillRect(2, 2, size - 4, size - 4);
  ctx.strokeRect(2, 2, size - 4, size - 4);
  return ctx.getImageData(0, 0, size, size);
}

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: { type: "raster", tiles: [USGS_IMAGERY], tileSize: 256, maxzoom: 16,
                 attribution: "Imagery: USGS The National Map" },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": color("--bg-canvas", "#f3f1ed") } },
      { id: "imagery", type: "raster", source: "imagery", layout: { visibility: "none" } },
    ],
  };
}

const TIER_LINES: { tier: string; width: number; dash?: number[] }[] = [
  { tier: "T4", width: 1.5, dash: [1, 3] },
  { tier: "T3", width: 2, dash: [6, 4] },
  { tier: "T2", width: 3 },
  { tier: "T1", width: 4 },
];

function addLayers(map: MLMap) {
  const ink = color("--text-primary", "#181011");
  const hair = color("--line-hairline", "#d8d4d4");
  const desc = color("--utility-desc", "#1a5fa8");
  const gpc = color("--utility-gpc", "#9a4f00");
  const violet = color("--overlap", "#6e36b5");

  map.addImage("sq-solid", squareImage(gpc, gpc, false));
  map.addImage("sq-hollow", squareImage(gpc, gpc, true));
  map.addSource("states", { type: "geojson", data: states() });
  map.addSource("study", { type: "geojson", data: studyAreaOutline() });
  map.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("overlaps", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("touch", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  map.addLayer({ id: "states-fill", type: "fill", source: "states", paint: { "fill-color": "#ffffff", "fill-opacity": 0.35 } });
  map.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": ink, "line-opacity": 0.4, "line-width": 1 } });
  map.addLayer({ id: "study", type: "line", source: "study", paint: { "line-color": ink, "line-width": 1, "line-dasharray": [4, 3] } });
  map.addLayer({ id: "proj-casing", type: "line", source: "lines", paint: { "line-color": "#ffffff", "line-width": 4 } });
  map.addLayer({ id: "proj-lines", type: "line", source: "lines",
    paint: { "line-color": ["match", ["get", "utility"], "DESC", desc, gpc], "line-width": 2 } });

  map.addLayer({ id: "ovl-casing", type: "line", source: "overlaps", filter: ["==", ["get", "tier"], "T1"],
    paint: { "line-color": "#ffffff", "line-width": 7 } });
  for (const t of TIER_LINES) {
    map.addLayer({ id: `ovl-${t.tier}`, type: "line", source: "overlaps", filter: ["==", ["get", "tier"], t.tier],
      layout: { "line-cap": t.dash ? "butt" : "round" },
      paint: { "line-color": violet, "line-width": ["case", ["get", "selected"], t.width + 2, t.width],
               ...(t.dash ? { "line-dasharray": t.dash } : {}) } });
  }
  map.addLayer({ id: "ovl-none", type: "line", source: "overlaps", filter: ["==", ["get", "tier"], "none"],
    paint: { "line-color": hair, "line-width": 1, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "ovl-hit", type: "line", source: "overlaps", paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 14 } });
  map.addLayer({ id: "touch-ring", type: "circle", source: "touch",
    paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": violet, "circle-stroke-width": 3 } });

  const hollow: ExpressionSpecification = ["in", ["get", "precision"], ["literal", ["endpoint_proxy", "regional_approximation"]]];
  map.addLayer({ id: "desc-points", type: "circle", source: "points", filter: ["==", ["get", "utility"], "DESC"],
    paint: { "circle-radius": 5, "circle-color": ["case", hollow, "#ffffff", desc], "circle-stroke-color": ["case", hollow, desc, "#ffffff"],
             "circle-stroke-width": ["case", hollow, 2, 1] } });
  map.addLayer({ id: "gpc-points", type: "symbol", source: "points", filter: ["==", ["get", "utility"], "GPC"],
    layout: { "icon-image": ["case", hollow, "sq-hollow", "sq-solid"], "icon-allow-overlap": true } });
  map.addLayer({ id: "sperry-dot", type: "circle", source: "points", filter: ["==", ["get", "precision"], "sperry_provided"],
    paint: { "circle-radius": 1.6, "circle-color": ink } });
}

export function MapView({ projects, opportunities, selectedId, method, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const shownMethod = useRef<Method>(method);
  const labels = useRef<maplibregl.Marker[]>([]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current, style: baseStyle(), attributionControl: { compact: true },
      bounds: [[STUDY_AREA.west - 0.6, STUDY_AREA.south - 0.4], [STUDY_AREA.east + 0.6, STUDY_AREA.north + 0.2]],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => { addLayers(map); setReady(true); });
    map.on("click", "ovl-hit", (e) => { const id = e.features?.[0]?.properties?.id; if (id) onSelectRef.current(String(id)); });
    map.on("mouseenter", "ovl-hit", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "ovl-hit", () => { map.getCanvas().style.cursor = ""; });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("lines") as GeoJSONSource).setData(projectLines(projects));
    (map.getSource("points") as GeoJSONSource).setData(projectPoints(projects));
  }, [ready, projects]);

  // Overlap lines; when the method changes, slide them from the old ends to the new ends.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const overlaps = map.getSource("overlaps") as GeoJSONSource;
    const touch = map.getSource("touch") as GeoJSONSource;
    const from = shownMethod.current;
    shownMethod.current = method;
    if (from === method || reducedMotion()) {
      overlaps.setData(overlapLines(opportunities, method, method, 1, selectedId));
      touch.setData(touchPoints(opportunities, method));
      return;
    }
    touch.setData(touchPoints(opportunities, "center"));
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / METHOD_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      overlaps.setData(overlapLines(opportunities, from, method, eased, selectedId));
      if (t < 1) frame = requestAnimationFrame(step);
      else touch.setData(touchPoints(opportunities, method));
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ready, opportunities, method, selectedId]);

  // Fit the selected pair and label its two projects (HTML labels: no glyph server needed).
  useEffect(() => {
    const map = mapRef.current;
    labels.current.forEach((m) => m.remove());
    labels.current = [];
    if (!ready || !map || !selectedId) return;
    const selected = opportunities.find((o) => o.id === selectedId);
    if (!selected) return;
    const bounds = pairBounds(selected, byId);
    if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: reducedMotion() ? 0 : FLY_MS });
    for (const ref of [selected.a, selected.b]) {
      const located = byId.get(ref.id)?.endpoints.filter((e) => e.lat != null) ?? [];
      for (const e of located) {
        const el = document.createElement("div");
        el.className = `map-label map-label--${ref.utility}`;
        el.textContent = e.osm_name ?? e.name_raw;
        labels.current.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -8] })
          .setLngLat([e.lon!, e.lat!]).addTo(map));
      }
    }
  }, [ready, selectedId, opportunities, byId]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) map.setLayoutProperty("imagery", "visibility", satellite ? "visible" : "none");
  }, [ready, satellite]);

  return (
    <section className="map-panel" aria-label="Map of projects and overlaps">
      <div ref={container} className="map" role="img" aria-label="Schematic map: DESC circles, GPC squares, violet overlap lines" />
      <span className="tag map-study-label">STUDY AREA · SAVANNAH / AUGUSTA</span>
      <button type="button" className="btn btn--ghost map-sat" aria-pressed={satellite} onClick={() => setSatellite((s) => !s)}>
        {satellite ? "Schematic" : "Satellite"}
      </button>
    </section>
  );
}
