import maplibregl, { type GeoJSONSource, type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";
import { pairsFor } from "../filters";
import { allBounds, connector, overlapLines, pairBounds, PLACES, projectLines, projectPoints, STUDY_AREA, studyAreaOutline } from "../mapData";
import type { Method, Opportunity, Project } from "../types";
import { MapLegend } from "./MapLegend";
import { Popover } from "./Popover";

const STATE_FIPS = new Set(["45", "13", "37", "12", "01", "47"]); // SC, GA + neighbors for context
const METHOD_MS = 300;
const FLY_MS = 600;
const DIM = 0.3;
const OTHER_GREY = "#b9b4ac";
const USGS_IMAGERY = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

interface Props {
  projects: Project[];
  opportunities: Opportunity[];
  selectedId: string | null;
  hoveredId: string | null;
  hoveredProjectId?: string | null;
  method: Method;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onProjectFilter?: (projectId: string) => void;
  /** Increments when the user picks a pair (queue, map, deep link): the map flies to it. */
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

function squareImage(fill: string, hollow: boolean): ImageData {
  const size = 14;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = hollow ? "#ffffff" : fill;
  ctx.strokeStyle = hollow ? fill : "#ffffff";
  ctx.lineWidth = 2;
  ctx.fillRect(2, 2, size - 4, size - 4);
  ctx.strokeRect(2, 2, size - 4, size - 4);
  return ctx.getImageData(0, 0, size, size);
}

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { imagery: { type: "raster", tiles: [USGS_IMAGERY], tileSize: 256, maxzoom: 16 } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": color("--bg-canvas", "#f3f1ed") } },
      { id: "imagery", type: "raster", source: "imagery", layout: { visibility: "none" } },
    ],
  };
}

const dimmed = ["case", ["get", "dim"], DIM, 1] as unknown as number;

function addLayers(map: MLMap) {
  const desc = color("--utility-desc", "#1a5fa8");
  const gpc = color("--utility-gpc", "#9a4f00");
  map.addImage("sq-solid", squareImage(gpc, false));
  map.addImage("sq-hollow", squareImage(gpc, true));
  map.addImage("sq-grey", squareImage(OTHER_GREY, false));
  for (const id of ["states", "study", "lines", "points", "overlaps", "connector", "touch"]) {
    map.addSource(id, { type: "geojson", data: id === "states" ? states() : id === "study" ? studyAreaOutline() : EMPTY });
  }
  map.addLayer({ id: "states-fill", type: "fill", source: "states", paint: { "fill-color": "#ffffff", "fill-opacity": 0.3 } });
  map.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": "#181011", "line-opacity": 0.35, "line-width": 1 } });
  map.addLayer({ id: "study", type: "line", source: "study", paint: { "line-color": "#181011", "line-opacity": 0.5, "line-width": 1, "line-dasharray": [4, 3] } });
  map.addLayer({ id: "overlaps", type: "line", source: "overlaps", paint: { "line-color": OTHER_GREY, "line-width": 1, "line-opacity": 0.55, "line-dasharray": [1, 2] } });
  map.addLayer({ id: "ovl-hit", type: "line", source: "overlaps", paint: { "line-color": "#000", "line-opacity": 0, "line-width": 12 } });
  map.addLayer({ id: "proj-casing", type: "line", source: "lines", filter: ["==", ["get", "focus"], true],
    paint: { "line-color": "#ffffff", "line-width": 6.5 } });
  map.addLayer({ id: "proj-lines", type: "line", source: "lines", layout: { "line-cap": "round" },
    paint: { "line-color": ["case", ["get", "dim"], OTHER_GREY, ["match", ["get", "utility"], "DESC", desc, gpc]],
             "line-width": ["case", ["get", "focus"], 3.5, 1.8], "line-opacity": dimmed } });
  map.addLayer({ id: "connector", type: "line", source: "connector", paint: { "line-color": "#181011", "line-width": 2, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "touch-ring", type: "circle", source: "touch",
    paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#181011", "circle-stroke-width": 2 } });
  const hollow = ["in", ["get", "precision"], ["literal", ["endpoint_proxy", "regional_approximation"]]] as unknown as boolean;
  map.addLayer({ id: "desc-points", type: "circle", source: "points", filter: ["==", ["get", "utility"], "DESC"],
    paint: { "circle-radius": ["case", ["get", "focus"], 6, 4.5] as unknown as number,
             "circle-color": ["case", ["get", "dim"], OTHER_GREY, hollow, "#ffffff", desc] as unknown as string,
             "circle-stroke-color": ["case", hollow, desc, "#ffffff"] as unknown as string, "circle-stroke-width": 1.5, "circle-opacity": dimmed,
             "circle-stroke-opacity": dimmed } });
  map.addLayer({ id: "gpc-points", type: "symbol", source: "points", filter: ["==", ["get", "utility"], "GPC"],
    layout: { "icon-image": ["case", ["get", "dim"], "sq-grey", hollow, "sq-hollow", "sq-solid"] as unknown as string, "icon-allow-overlap": true },
    paint: { "icon-opacity": dimmed } });
}

/** Re-read the CSS tokens after a theme switch (MapLibre paint values are not CSS). */
function applyTheme(map: MLMap) {
  const ink = color("--text-primary", "#181011");
  const desc = color("--utility-desc", "#1a5fa8");
  const gpc = color("--utility-gpc", "#9a4f00");
  map.setPaintProperty("bg", "background-color", color("--bg-canvas", "#f3f1ed"));
  map.setPaintProperty("states-fill", "fill-color", color("--bg-surface", "#ffffff"));
  map.setPaintProperty("proj-casing", "line-color", color("--bg-canvas", "#ffffff"));
  for (const id of ["states-line", "study", "connector"]) map.setPaintProperty(id, "line-color", ink);
  map.setPaintProperty("touch-ring", "circle-stroke-color", ink);
  map.setPaintProperty("proj-lines", "line-color", ["case", ["get", "dim"], OTHER_GREY, ["match", ["get", "utility"], "DESC", desc, gpc]]);
}

function withDim<T extends { features: { properties: Record<string, unknown> | null }[] }>(fc: T, hasFocus: boolean, hideUnrelated: boolean): T {
  const features = fc.features
    .map((f) => ({ ...f, properties: { ...f.properties, dim: hasFocus && !f.properties?.focus } }))
    .filter((f) => !(hideUnrelated && f.properties.dim));
  return { ...fc, features };
}

function projectCard(p: Project, count: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "map-card";
  const head = document.createElement("span");
  head.className = `chip chip--${p.utility}`;
  head.textContent = p.utility;
  const name = document.createElement("strong");
  name.textContent = p.name;
  const meta = document.createElement("span");
  meta.className = "muted";
  meta.textContent = `${count} ${count === 1 ? "opportunity" : "opportunities"} · click to filter queue`;
  el.append(head, name, meta);
  return el;
}

export function MapView({ projects, opportunities, selectedId, hoveredId, hoveredProjectId = null, method, onSelect, onHover,
  onProjectFilter, focusToken, theme }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [satellite, setSatellite] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const [hideUnrelated, setHideUnrelated] = useState(false);
  const shownMethod = useRef<Method>(method);
  const markers = useRef<maplibregl.Marker[]>([]);
  const places = useRef<maplibregl.Marker[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);
  const overviewShown = useRef(false);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const byOpp = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [opportunities]);
  const selected = selectedId ? byOpp.get(selectedId) : undefined;
  const hovered = hoveredId ? byOpp.get(hoveredId) : undefined;
  const focus = useMemo(() => new Set([selected?.a.id, selected?.b.id, hovered?.a.id, hovered?.b.id, hoveredProjectId]
    .filter((x): x is string => Boolean(x))), [selected, hovered, hoveredProjectId]);
  const callbacks = useRef({ onSelect, onHover, onProjectFilter, byOpp, byId, opportunities });
  callbacks.current = { onSelect, onHover, onProjectFilter, byOpp, byId, opportunities };

  useEffect(() => {
    if (!container.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: container.current, style: baseStyle(), attributionControl: false,
        bounds: [[STUDY_AREA.west - 0.6, STUDY_AREA.south - 0.4], [STUDY_AREA.east + 0.6, STUDY_AREA.north + 0.2]],
      });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "300px" });
    map.on("load", () => { addLayers(map); setReady(true); });
    map.on("webglcontextlost", () => setFailed(true));
    map.on("click", "ovl-hit", (e) => { const id = e.features?.[0]?.properties?.id; if (id) callbacks.current.onSelect(String(id)); });
    map.on("mousemove", "ovl-hit", (e) => {
      map.getCanvas().style.cursor = "pointer";
      callbacks.current.onHover(String(e.features?.[0]?.properties?.id ?? "") || null);
    });
    map.on("mouseleave", "ovl-hit", () => { map.getCanvas().style.cursor = ""; callbacks.current.onHover(null); });
    for (const layer of ["proj-lines", "desc-points", "gpc-points"]) {
      map.on("mousemove", layer, (e) => {
        const props = e.features?.[0]?.properties;
        const project = callbacks.current.byId.get(String(props?.project ?? props?.id));
        if (!project) return;
        map.getCanvas().style.cursor = "pointer";
        popup.current?.setLngLat(e.lngLat).setDOMContent(projectCard(project, pairsFor(project.id, callbacks.current.opportunities).length)).addTo(map);
      });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; popup.current?.remove(); });
      map.on("click", layer, (e) => {
        const props = e.features?.[0]?.properties;
        const id = String(props?.project ?? props?.id ?? "");
        if (id) callbacks.current.onProjectFilter?.(id);
      });
    }
    for (const place of PLACES) {
      const el = document.createElement("div");
      el.className = `map-place map-place--${place.kind}`;
      el.textContent = place.name;
      places.current.push(new maplibregl.Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map));
    }
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __gridpulseMap?: MLMap }).__gridpulseMap = map;
    return () => {
      popup.current?.remove();
      places.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [attempt]);

  const hasFocus = focus.size > 0;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("lines") as GeoJSONSource).setData(withDim(projectLines(projects, focus), hasFocus, hideUnrelated));
    (map.getSource("points") as GeoJSONSource).setData(withDim(projectPoints(projects, focus), hasFocus, hideUnrelated));
  }, [ready, projects, focus, hasFocus, hideUnrelated]);

  const fitAll = (animate = true) => {
    const map = mapRef.current;
    const bounds = allBounds(opportunities);
    if (map && bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: animate && !reducedMotion() ? FLY_MS : 0 });
  };

  useEffect(() => {
    if (!ready || overviewShown.current || !opportunities.length) return;
    overviewShown.current = true;
    const requested = selectedId ? byOpp.get(selectedId) : undefined;
    const bounds = focusToken > 0 && requested ? pairBounds(requested, byId) : null;
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 110, maxZoom: 10.5, duration: 0 }); // deep link: open on the pair
    else fitAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, opportunities]);

  // Other pairs as faint context; the selected pair's connector slides between centers and closest points.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const others = hideUnrelated ? [] : opportunities.filter((o) => o.id !== selectedId);
    (map.getSource("overlaps") as GeoJSONSource).setData(overlapLines(others, method, method, 1, null));
    const conn = map.getSource("connector") as GeoJSONSource;
    const touch = map.getSource("touch") as GeoJSONSource;
    touch.setData(selected?.touching && method === "closest"
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: connector(selected, method).mid } }] }
      : EMPTY);
    const from = shownMethod.current;
    shownMethod.current = method;
    if (!selected) { conn.setData(EMPTY); return; }
    if (from === method || reducedMotion()) { conn.setData(overlapLines([selected], method, method, 1, null)); return; }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / METHOD_MS);
      conn.setData(overlapLines([selected], from, method, 1 - Math.pow(1 - t, 3), null));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ready, opportunities, selected, selectedId, method, hideUnrelated]);

  // HTML labels: selected/hovered endpoints (halo, no boxes) and the connector's distance pill.
  useEffect(() => {
    const map = mapRef.current;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (!ready || !map) return;
    for (const id of focus) {
      for (const e of byId.get(id)?.endpoints.filter((ep) => ep.lat != null) ?? []) {
        const el = document.createElement("div");
        el.className = "map-label";
        el.textContent = (e.osm_name ?? e.name_raw).replace(/ (Substation|Switching Station)$/i, "");
        markers.current.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [9, 0] }).setLngLat([e.lon!, e.lat!]).addTo(map));
      }
    }
    if (selected) {
      const c = connector(selected, method);
      const pill = document.createElement("div");
      pill.className = "map-pill";
      pill.textContent = c.label;
      markers.current.push(new maplibregl.Marker({ element: pill, anchor: "top", offset: [0, 14] }).setLngLat(c.mid).addTo(map));
    }
  }, [ready, focus, byId, selected, method]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selected || focusToken === 0) return;
    const bounds = pairBounds(selected, byId);
    if (bounds) map.fitBounds(bounds, { padding: 110, maxZoom: 10.5, duration: reducedMotion() ? 0 : FLY_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const frame = requestAnimationFrame(() => applyTheme(map)); // parent sets <html data-theme> after this effect
    return () => cancelAnimationFrame(frame);
  }, [ready, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("imagery", "visibility", satellite ? "visible" : "none");
    places.current.forEach((p) => {
      p.getElement().classList.toggle("is-on-imagery", satellite);
      p.getElement().style.display = showPlaces ? "" : "none";
    });
  }, [ready, satellite, showPlaces]);

  if (failed) {
    return (
      <section className="map-panel map-panel--failed" aria-label="Map unavailable">
        <div className="map-fallback">
          <p className="map-fallback__title">Map unavailable</p>
          <p className="muted">This browser could not start the map renderer. Rankings, evidence and exports are unaffected.</p>
          <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
        </div>
      </section>
    );
  }

  const zoom = (delta: number) => mapRef.current?.easeTo({ zoom: (mapRef.current?.getZoom() ?? 7) + delta, duration: reducedMotion() ? 0 : 200 });

  return (
    <section className="map-panel" aria-label="Map of projects and overlaps">
      <div ref={container} className="map" role="img" aria-label="Map: DESC projects as blue circles, Georgia Power as orange squares; the selected pair is joined by a dashed line" />
      {!ready && <div className="map-loading" aria-hidden="true" />}
      <div className="map-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => fitAll()} aria-label="Fit all pairs">Fit</button>
      </div>
      <div className="map-tools">
        <button type="button" className="btn btn--map" aria-pressed={hideUnrelated} onClick={() => setHideUnrelated((h) => !h)}>
          {hideUnrelated ? "Show all" : "Hide unrelated"}
        </button>
        <Popover label="Layers" ariaLabel="Map layers" align="right" className="popover--map">
          {() => (
            <div className="menu">
              <label className="check"><input type="checkbox" checked={satellite} onChange={() => setSatellite((s) => !s)} /> Satellite imagery (USGS)</label>
              <label className="check"><input type="checkbox" checked={showPlaces} onChange={() => setShowPlaces((s) => !s)} /> Place labels</label>
            </div>
          )}
        </Popover>
      </div>
      <MapLegend />
      <p className="map-attrib">Unresolved endpoints are not drawn · © OpenStreetMap contributors (ODbL) · US Census{satellite ? " · USGS imagery" : ""}</p>
    </section>
  );
}
