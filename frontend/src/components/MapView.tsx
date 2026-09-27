import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";
import { allBounds, overlapLines, pairBounds, PLACES, projectLines, projectPoints, STUDY_AREA, studyAreaOutline, touchPoints } from "../mapData";
import { TIER_TEXT } from "../format";
import type { Method, Opportunity, Project } from "../types";

const STATE_FIPS = new Set(["45", "13", "37", "12", "01", "47"]); // SC, GA + neighbors for context
const METHOD_MS = 300;
const FLY_MS = 600;
const USGS_IMAGERY = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";

interface Props {
  projects: Project[];
  opportunities: Opportunity[];
  selectedId: string | null;
  hoveredId: string | null;
  method: Method;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Increments when the user picks a pair (table, map, deep link): the map flies to it. */
  focusToken: number;
  theme?: string;
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
      paint: { "line-color": violet, "line-width": ["case", ["get", "focus"], t.width + 2, t.width],
               "line-opacity": ["case", ["get", "focus"], 1, 0.35],
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

/** Re-read the CSS tokens after a theme switch (MapLibre paint values are not CSS). */
function applyTheme(map: MLMap) {
  const ink = color("--text-primary", "#181011");
  const desc = color("--utility-desc", "#1a5fa8");
  const gpc = color("--utility-gpc", "#9a4f00");
  const violet = color("--overlap", "#6e36b5");
  map.setPaintProperty("bg", "background-color", color("--bg-canvas", "#f3f1ed"));
  map.setPaintProperty("proj-casing", "line-color", color("--bg-canvas", "#ffffff"));
  map.setPaintProperty("ovl-casing", "line-color", color("--bg-canvas", "#ffffff"));
  map.setPaintProperty("states-fill", "fill-color", color("--bg-surface", "#ffffff"));
  map.setPaintProperty("states-line", "line-color", ink);
  map.setPaintProperty("study", "line-color", ink);
  map.setPaintProperty("proj-lines", "line-color", ["match", ["get", "utility"], "DESC", desc, gpc]);
  map.setPaintProperty("desc-points", "circle-stroke-color", ["case", ["in", ["get", "precision"],
    ["literal", ["endpoint_proxy", "regional_approximation"]]], desc, "#ffffff"]);
  for (const t of TIER_LINES) map.setPaintProperty(`ovl-${t.tier}`, "line-color", violet);
  map.setPaintProperty("touch-ring", "circle-stroke-color", violet);
}

function tooltip(o: Opportunity): HTMLElement {
  const el = document.createElement("div");
  el.className = "map-tip";
  const head = document.createElement("strong");
  head.textContent = o.tier ? `${o.tier} · ${TIER_TEXT[o.tier]}` : "BEYOND 25 MI";
  const pair = document.createElement("span");
  pair.textContent = `DESC ${o.a.name}  ×  GPC ${o.b.name}`;
  const dist = document.createElement("span");
  dist.className = "mono";
  dist.textContent = `${o.touching ? "touching" : `${o.dist_closest_mi.toFixed(2)} mi closest`} · ${o.dist_center_mi.toFixed(2)} mi centers`;
  el.append(head, pair, dist);
  return el;
}

export function MapView({ projects, opportunities, selectedId, hoveredId, method, onSelect, onHover, focusToken, theme }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const shownMethod = useRef<Method>(method);
  const labels = useRef<maplibregl.Marker[]>([]);
  const places = useRef<maplibregl.Marker[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);
  const overviewShown = useRef(false);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const byOpp = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [opportunities]);
  const callbacks = useRef({ onSelect, onHover, byOpp });
  callbacks.current = { onSelect, onHover, byOpp };

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current, style: baseStyle(), attributionControl: { compact: true },
      bounds: [[STUDY_AREA.west - 0.6, STUDY_AREA.south - 0.4], [STUDY_AREA.east + 0.6, STUDY_AREA.north + 0.2]],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "320px" });
    map.on("load", () => { addLayers(map); setReady(true); });
    map.on("click", "ovl-hit", (e) => { const id = e.features?.[0]?.properties?.id; if (id) callbacks.current.onSelect(String(id)); });
    map.on("mousemove", "ovl-hit", (e) => {
      const id = String(e.features?.[0]?.properties?.id ?? "");
      const o = callbacks.current.byOpp.get(id);
      map.getCanvas().style.cursor = "pointer";
      callbacks.current.onHover(id || null);
      if (o) popup.current?.setLngLat(e.lngLat).setDOMContent(tooltip(o)).addTo(map);
    });
    map.on("mouseleave", "ovl-hit", () => {
      map.getCanvas().style.cursor = "";
      callbacks.current.onHover(null);
      popup.current?.remove();
    });
    for (const place of PLACES) {
      const el = document.createElement("div");
      el.className = `map-place map-place--${place.kind}`;
      el.textContent = place.name;
      places.current.push(new maplibregl.Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map));
    }
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __gridpulseMap?: MLMap }).__gridpulseMap = map;
    return () => { popup.current?.remove(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("lines") as GeoJSONSource).setData(projectLines(projects));
    (map.getSource("points") as GeoJSONSource).setData(projectPoints(projects));
  }, [ready, projects]);

  const fitAll = (animate = true) => {
    const map = mapRef.current;
    const bounds = allBounds(opportunities);
    if (map && bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: animate && !reducedMotion() ? FLY_MS : 0 });
  };

  // First data: show the whole region, not one pair.
  useEffect(() => {
    if (!ready || overviewShown.current || !opportunities.length) return;
    overviewShown.current = true;
    fitAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, opportunities]);

  // Overlap lines; when the method changes, slide them from the old ends to the new ends.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const overlaps = map.getSource("overlaps") as GeoJSONSource;
    const touch = map.getSource("touch") as GeoJSONSource;
    const from = shownMethod.current;
    shownMethod.current = method;
    if (from === method || reducedMotion()) {
      overlaps.setData(overlapLines(opportunities, method, method, 1, selectedId, hoveredId));
      touch.setData(touchPoints(opportunities, method));
      return;
    }
    touch.setData(touchPoints(opportunities, "center"));
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / METHOD_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      overlaps.setData(overlapLines(opportunities, from, method, eased, selectedId, hoveredId));
      if (t < 1) frame = requestAnimationFrame(step);
      else touch.setData(touchPoints(opportunities, method));
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ready, opportunities, method, selectedId, hoveredId]);

  // Label the selected pair's projects (HTML labels: no glyph server needed).
  useEffect(() => {
    const map = mapRef.current;
    labels.current.forEach((m) => m.remove());
    labels.current = [];
    const selected = selectedId ? byOpp.get(selectedId) : undefined;
    if (!ready || !map || !selected) return;
    for (const ref of [selected.a, selected.b]) {
      for (const e of byId.get(ref.id)?.endpoints.filter((ep) => ep.lat != null) ?? []) {
        const el = document.createElement("div");
        el.className = `map-label map-label--${ref.utility}`;
        el.textContent = e.osm_name ?? e.name_raw;
        labels.current.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -8] })
          .setLngLat([e.lon!, e.lat!]).addTo(map));
      }
    }
  }, [ready, selectedId, byOpp, byId]);

  // Fly only when the user asked for a pair.
  useEffect(() => {
    const map = mapRef.current;
    const selected = selectedId ? byOpp.get(selectedId) : undefined;
    if (!ready || !map || !selected || focusToken === 0) return;
    const bounds = pairBounds(selected, byId);
    if (bounds) map.fitBounds(bounds, { padding: 90, maxZoom: 10.5, duration: reducedMotion() ? 0 : FLY_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // The parent sets <html data-theme> in its own effect, which runs after this one: wait a frame.
    const frame = requestAnimationFrame(() => applyTheme(map));
    return () => cancelAnimationFrame(frame);
  }, [ready, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("imagery", "visibility", satellite ? "visible" : "none");
    places.current.forEach((p) => p.getElement().classList.toggle("is-on-imagery", satellite));
  }, [ready, satellite]);

  return (
    <section className="map-panel" aria-label="Map of projects and overlaps">
      <div ref={container} className="map" role="img" aria-label="Schematic map: DESC circles, GPC squares, violet overlap lines" />
      <span className="tag map-study-label">STUDY AREA · SAVANNAH / AUGUSTA</span>
      <div className="map-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => fitAll()} title="Zoom out to every pair">Fit all</button>
        <button type="button" className="btn btn--ghost btn--sm" aria-pressed={satellite} onClick={() => setSatellite((s) => !s)}>
          {satellite ? "Schematic" : "Satellite"}
        </button>
      </div>
    </section>
  );
}
