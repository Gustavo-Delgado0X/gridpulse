import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { DataQualityView } from "./components/DataQualityView";
import { DetailPanel } from "./components/DetailPanel";
import { MapView } from "./components/MapView";
import { OpportunityTable } from "./components/OpportunityTable";
import { PairPanel } from "./components/PairPanel";
import { PlanChangesView } from "./components/PlanChangesView";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { Sidebar, type Theme, type View } from "./components/Sidebar";
import { StudyBar } from "./components/StudyBar";
import { applyFilters, EMPTY_FILTERS, type Filters } from "./filters";
import type { Change, Health, Method, Opportunity, OpportunityDetail, Project, Quality } from "./types";
import { parseHash, toHash } from "./urlState";
import { useTriage } from "./useTriage";

type Load<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; message: string };
type Pane = "list" | "map" | "detail"; // mobile only: which column is visible
type Panel = "list" | "detail"; // left column of the two-column layout

function useLoad<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetcher(controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setState({ status: "error", message: err instanceof ApiError ? err.message : String(err) });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return [state, () => setAttempt((a) => a + 1)];
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="alert alert--danger" role="alert">
      <p className="alert__title">Could not load data</p>
      <p>{message}</p>
      <p className="alert__actions"><button type="button" className="btn" onClick={onRetry}>Retry</button></p>
    </div>
  );
}

function Skeleton({ rows = 6 }: { rows?: number }) {
  return <div className="skeleton" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton__row" />)}</div>;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (private mode): fall back to defaults
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting still applies for this visit.
  }
}

const readTheme = (): Theme => (readStored("gridpulse.theme") === "dark" ? "dark" : "light");

const INITIAL = typeof window === "undefined" ? {} : parseHash(window.location.hash);

export default function App() {
  const [view, setView] = useState<View>("opportunities");
  const [method, setMethod] = useState<Method>(INITIAL.method ?? "closest");
  const [distance, setDistance] = useState(INITIAL.d ?? 25);
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL.pair ?? null);
  const [focusToken, setFocusToken] = useState(INITIAL.pair ? 1 : 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [changesFor, setChangesFor] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [pane, setPane] = useState<Pane>("list");
  const [panel, setPanel] = useState<Panel>(INITIAL.pair ? "detail" : "list");
  const [wide, setWide] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readStored("gridpulse.sidebar") === "collapsed");
  const [help, setHelp] = useState(false);
  const [triage, setTriage] = useTriage();

  const [health] = useLoad<Health>((s) => api.health(s), []);
  const [projects] = useLoad<Project[]>((s) => api.projects(s), []);
  const [opps, retryOpps] = useLoad<Opportunity[]>((s) => api.opportunities({ d: distance, method }, s), [distance, method]);
  const [detail, retryDetail] = useLoad<OpportunityDetail | null>(
    (s) => (selectedId ? api.opportunity(selectedId, method, s) : Promise.resolve(null)), [selectedId, method]);
  const [quality, retryQuality] = useLoad<Quality>((s) => api.quality(s), []);
  const [changes, retryChanges] = useLoad<Change[]>((s) => api.changes(s), []);

  const all = useMemo(() => (opps.status === "ok" ? opps.data : []), [opps]);
  const items = useMemo(() => applyFilters(all, filters, triage), [all, filters, triage]);
  const projectList = useMemo(() => (projects.status === "ok" ? projects.data : []), [projects]);
  const changeList = useMemo(() => (changes.status === "ok" ? changes.data : []), [changes]);

  // Keep a selection that is visible; auto-selection never moves the map (focusToken stays).
  useEffect(() => {
    if (opps.status !== "ok" || items.some((o) => o.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? null);
  }, [opps.status, items, selectedId]);

  useEffect(() => {
    const hash = toHash({ pair: selectedId ?? undefined, method, d: distance });
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [selectedId, method, distance]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store("gridpulse.theme", theme);
  }, [theme]);

  useEffect(() => store("gridpulse.sidebar", collapsed ? "collapsed" : "expanded"), [collapsed]);

  useEffect(() => {
    if (!selectedId && panel === "detail") setPanel("list");
  }, [selectedId, panel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "?") setHelp((h) => !h);
      if (event.key === "m" || event.key === "M") setMethod((m) => (m === "closest" ? "center" : "closest"));
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setPanel("list");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // A share link pasted into this tab only changes the hash (no reload): apply it like a fresh visit.
  // Our own replaceState calls never fire hashchange, so this only runs on user navigation.
  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash);
      if (next.method) setMethod(next.method);
      if (next.d) setDistance(next.d);
      if (!next.pair) return;
      setView("opportunities");
      setFilters(EMPTY_FILTERS);
      setSelectedId(next.pair);
      setFocusToken((t) => t + 1);
      setPanel("detail");
      setPane("detail");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = useCallback((id: string) => {
    setSelectedId(id);
    setFocusToken((t) => t + 1);
  }, []);

  const openDetail = useCallback((id: string) => {
    choose(id);
    setPanel("detail");
    setPane("detail");
  }, [choose]);

  const openOpportunity = useCallback((id: string) => {
    setView("opportunities");
    setFilters(EMPTY_FILTERS);
    openDetail(id);
  }, [openDetail]);

  const selected = items.find((o) => o.id === selectedId);
  const acceptance = quality.status === "ok" ? quality.data.acceptance : null;
  const projectName = filters.projectId ? projectList.find((p) => p.id === filters.projectId)?.name : undefined;

  const counts = { opportunities: opps.status === "ok" ? all.length : null, changes: changes.status === "ok" ? changeList.length : null,
                  issues: quality.status === "ok" ? quality.data.discrepancies.length : null };
  const showPane = (p: Pane) => { setPane(p); if (p !== "map") setPanel(p === "detail" && selectedId ? "detail" : "list"); };

  const detailBody = (
    <>
      {detail.status === "loading" && selectedId && <Skeleton rows={8} />}
      {detail.status === "error" && <ErrorCard message={detail.message} onRetry={retryDetail} />}
      {detail.status === "ok" && detail.data && selectedId && (
        <DetailPanel key={`${detail.data.id}:${method}`} detail={detail.data} triage={triage[detail.data.id] ?? "new"}
                     onTriage={(t) => setTriage(detail.data!.id, t)} changes={changeList} onHoverProject={setHoveredProjectId}
                     onViewChanges={(projectId) => { setChangesFor(projectId); setView("changes"); }}
                     briefUrl={(q) => `${api.briefUrl(detail.data!.id, method)}&${q}`}
                     voice={health.status === "ok" && health.data.voice === "available"
                       ? { audioUrl: api.briefAudioUrl(detail.data.id, method), loadScript: () => api.briefScript(detail.data!.id, method) }
                       : undefined} />
      )}
    </>
  );

  return (
    <div className={`shell ${collapsed ? "shell--collapsed" : ""}`}>
      <Sidebar view={view} onView={setView} counts={counts} collapsed={collapsed} onCollapse={setCollapsed}
               query={filters.query} onQuery={(q) => setFilters((f) => ({ ...f, query: q }))} acceptance={acceptance}
               dataMode={health.status === "ok" ? health.data.data_mode : null} theme={theme} onTheme={setTheme} onHelp={() => setHelp(true)} />
      <div className="shell__main">
        <p className="sr-only" aria-live="polite">{selected ? `Selected: ${selected.a.name} and ${selected.b.name}, tier ${selected.tier ?? "none"}` : ""}</p>
        <ShortcutsDialog open={help} onClose={() => setHelp(false)} />

        {view === "opportunities" && (
          <>
            <StudyBar items={all} filters={filters} method={method} onMethod={setMethod} distance={distance} onDistance={setDistance}
                      onReset={() => setFilters(EMPTY_FILTERS)}
                      onMustCoordinate={() => setFilters((f) => ({ ...f, tiers: f.tiers.length === 1 && f.tiers[0] === "T1" ? [] : ["T1"] }))}
                      onOverlap={() => setFilters((f) => ({ ...f, sameWindowOnly: !f.sameWindowOnly }))}
                      onConflicts={() => setFilters((f) => ({ ...f, flags: f.flags.includes("sources_disagree")
                        ? f.flags.filter((x) => x !== "sources_disagree") : [...f.flags, "sources_disagree"] }))} />
            <div className="pane-switch segmented" role="tablist" aria-label="Panels">
              {(["list", "map", "detail"] as Pane[]).map((p) => (
                <button key={p} type="button" role="tab" aria-selected={pane === p} className="segmented__item" onClick={() => showPane(p)}>
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <main className={`two-col ${wide ? "two-col--wide" : ""} pane--${pane === "map" ? "map" : "panel"}`}>
              <div className="col col--panel">
                {panel === "list" ? (
                  <>
                    {opps.status === "loading" && <Skeleton />}
                    {opps.status === "error" && <ErrorCard message={opps.message} onRetry={retryOpps} />}
                    {opps.status === "ok" && (
                      <OpportunityTable items={items} total={all.length} filters={filters} onFilters={setFilters} selectedId={selectedId}
                                        onSelect={choose} onOpen={openDetail} onHover={setHoveredId} triage={triage} method={method}
                                        distance={distance} onWiden={() => setDistance(50)} csvUrl={api.csvUrl({ d: distance, method })}
                                        projectName={projectName} />
                    )}
                  </>
                ) : (
                  <PairPanel items={items} selectedId={selectedId} onBack={() => { setPanel("list"); setPane("list"); }} onSelect={choose}
                             wide={wide} onWide={setWide}>
                    {detailBody}
                  </PairPanel>
                )}
              </div>
              <div className="col col--map">
                <MapView projects={projectList} opportunities={items} selectedId={selectedId} hoveredId={hoveredId}
                         hoveredProjectId={hoveredProjectId} method={method} onSelect={openDetail} onHover={setHoveredId}
                         onProjectFilter={(id) => { setFilters((f) => ({ ...f, projectId: id })); setPanel("list"); }}
                         focusToken={focusToken} theme={theme} />
              </div>
            </main>
          </>
        )}
        {view === "changes" && (changes.status === "ok"
          ? <PlanChangesView key={changesFor ?? "all"} changes={changeList} opportunities={all} onOpenOpportunity={openOpportunity} initialProjectId={changesFor} />
          : changes.status === "error" ? <main className="page"><ErrorCard message={changes.message} onRetry={retryChanges} /></main> : <Skeleton />)}
        {view === "quality" && (quality.status === "ok"
          ? <DataQualityView quality={quality.data} opportunities={all} onOpenOpportunity={openOpportunity} />
          : quality.status === "error" ? <main className="page"><ErrorCard message={quality.message} onRetry={retryQuality} /></main> : <Skeleton />)}
      </div>
    </div>
  );
}
