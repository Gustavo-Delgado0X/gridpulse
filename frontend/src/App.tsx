import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { DataQualityView } from "./components/DataQualityView";
import { DetailPanel } from "./components/DetailPanel";
import { MapView } from "./components/MapView";
import { OpportunitiesToolbar } from "./components/OpportunitiesToolbar";
import { OpportunityTable } from "./components/OpportunityTable";
import { PlanChangesView } from "./components/PlanChangesView";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { TopBar, type Theme, type View } from "./components/TopBar";
import { applyFilters, EMPTY_FILTERS, type Filters } from "./filters";
import type { Change, Health, Method, Opportunity, OpportunityDetail, Project, Quality } from "./types";
import { parseHash, toHash } from "./urlState";
import { useTriage } from "./useTriage";

type Load<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; message: string };
type Pane = "list" | "map" | "detail";

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

function readTheme(): Theme {
  try {
    return window.localStorage.getItem("gridpulse.theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

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
    try {
      window.localStorage.setItem("gridpulse.theme", theme);
    } catch {
      // Storage unavailable: the theme still applies for this visit.
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "?") setHelp((h) => !h);
      if (event.key === "m" || event.key === "M") setMethod((m) => (m === "closest" ? "center" : "closest"));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const choose = useCallback((id: string) => {
    setSelectedId(id);
    setFocusToken((t) => t + 1);
  }, []);

  const openOpportunity = useCallback((id: string) => {
    setView("opportunities");
    setFilters(EMPTY_FILTERS);
    choose(id);
  }, [choose]);

  const selected = items.find((o) => o.id === selectedId);
  const acceptance = quality.status === "ok" ? quality.data.acceptance : null;
  const projectName = filters.projectId ? projectList.find((p) => p.id === filters.projectId)?.name : undefined;

  return (
    <div className="app">
      <TopBar view={view} onView={setView}
              counts={{ opportunities: opps.status === "ok" ? all.length : null, changes: changes.status === "ok" ? changeList.length : null,
                        issues: quality.status === "ok" ? quality.data.discrepancies.length : null }}
              query={filters.query} onQuery={(q) => setFilters((f) => ({ ...f, query: q }))} acceptance={acceptance}
              dataMode={health.status === "ok" ? health.data.data_mode : null} theme={theme} onTheme={setTheme} onHelp={() => setHelp(true)} />
      <p className="sr-only" aria-live="polite">{selected ? `Selected: ${selected.a.name} and ${selected.b.name}, tier ${selected.tier ?? "none"}` : ""}</p>
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />

      {view === "opportunities" && (
        <>
          <OpportunitiesToolbar items={all} filters={filters} method={method} onMethod={setMethod} distance={distance} onDistance={setDistance}
                                onReset={() => setFilters(EMPTY_FILTERS)}
                                onMustCoordinate={() => setFilters((f) => ({ ...f, tiers: f.tiers.length === 1 && f.tiers[0] === "T1" ? [] : ["T1"] }))}
                                onOverlap={() => setFilters((f) => ({ ...f, sameWindowOnly: !f.sameWindowOnly }))}
                                onConflicts={() => setFilters((f) => ({ ...f, flags: f.flags.includes("sources_disagree")
                                  ? f.flags.filter((x) => x !== "sources_disagree") : [...f.flags, "sources_disagree"] }))} />
          <div className="pane-switch segmented" role="tablist" aria-label="Panels">
            {(["list", "map", "detail"] as Pane[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={pane === p} className="segmented__item" onClick={() => setPane(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <main className={`workspace pane--${pane}`}>
            <div className="col col--queue">
              {opps.status === "loading" && <Skeleton />}
              {opps.status === "error" && <ErrorCard message={opps.message} onRetry={retryOpps} />}
              {opps.status === "ok" && (
                <OpportunityTable items={items} total={all.length} filters={filters} onFilters={setFilters} selectedId={selectedId}
                                  onSelect={(id) => { choose(id); if (window.matchMedia?.("(max-width: 900px)").matches) setPane("detail"); }}
                                  onHover={setHoveredId} triage={triage} method={method} distance={distance}
                                  onWiden={() => setDistance(50)} csvUrl={api.csvUrl({ d: distance, method })} projectName={projectName} />
              )}
            </div>
            <div className="col col--map">
              <MapView projects={projectList} opportunities={items} selectedId={selectedId} hoveredId={hoveredId}
                       hoveredProjectId={hoveredProjectId} method={method} onSelect={choose} onHover={setHoveredId}
                       onProjectFilter={(id) => setFilters((f) => ({ ...f, projectId: id }))} focusToken={focusToken} theme={theme} />
            </div>
            <div className="col col--detail">
              {detail.status === "loading" && selectedId && <Skeleton rows={8} />}
              {detail.status === "error" && <ErrorCard message={detail.message} onRetry={retryDetail} />}
              {detail.status === "ok" && detail.data && selectedId && (
                <DetailPanel key={`${detail.data.id}:${method}`} detail={detail.data} triage={triage[detail.data.id] ?? "new"}
                             onTriage={(t) => setTriage(detail.data!.id, t)} changes={changeList} onHoverProject={setHoveredProjectId}
                             onViewChanges={(projectId) => { setChangesFor(projectId); setView("changes"); }}
                             briefUrl={(q) => `${api.briefUrl(detail.data!.id, method)}&${q}`} />
              )}
              {!selectedId && opps.status === "ok" && (
                <div className="empty"><p className="empty__title">Nothing selected</p><p className="muted">Pick a pair from the queue or the map.</p></div>
              )}
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
  );
}
