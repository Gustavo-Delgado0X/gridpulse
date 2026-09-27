import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { DataQualityView } from "./components/DataQualityView";
import { DetailPanel } from "./components/DetailPanel";
import { ExportMenu } from "./components/ExportMenu";
import { InsetAlertCard } from "./components/InsetAlertCard";
import { MapLegend } from "./components/MapLegend";
import { MapView } from "./components/MapView";
import { OpportunityTable } from "./components/OpportunityTable";
import { PlanChangesView } from "./components/PlanChangesView";
import { TopBar, type View } from "./components/TopBar";
import type { Change, Health, Method, Opportunity, OpportunityDetail, Project, Quality } from "./types";
import { useTriage } from "./useTriage";

type Load<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; message: string };

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
    <InsetAlertCard tag="ERROR" title="Could not load data" tone="danger">
      <p>{message}</p><button type="button" className="btn btn--ghost" onClick={onRetry}>Retry</button>
    </InsetAlertCard>
  );
}

function Skeleton() {
  return <div className="skeleton" aria-busy="true" aria-label="Loading">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton__row" />)}</div>;
}

export default function App() {
  const [view, setView] = useState<View>("opportunities");
  const [method, setMethod] = useState<Method>("closest");
  const [distance, setDistance] = useState(25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triage, setTriage] = useTriage();

  const [health] = useLoad<Health>((s) => api.health(s), []);
  const [projects] = useLoad<Project[]>((s) => api.projects(s), []);
  const [opps, retryOpps] = useLoad<Opportunity[]>((s) => api.opportunities({ d: distance, method }, s), [distance, method]);
  const [detail, retryDetail] = useLoad<OpportunityDetail | null>(
    (s) => (selectedId ? api.opportunity(selectedId, method, s) : Promise.resolve(null)), [selectedId, method]);
  const [quality, retryQuality] = useLoad<Quality>((s) => api.quality(s), []);
  const [changes, retryChanges] = useLoad<Change[]>((s) => api.changes(s), []);

  const items = opps.status === "ok" ? opps.data : [];
  useEffect(() => {
    if (opps.status === "ok" && opps.data.length && !opps.data.some((o) => o.id === selectedId)) setSelectedId(opps.data[0].id);
  }, [opps, selectedId]);

  const selected = items.find((o) => o.id === selectedId);
  const csvUrl = api.csvUrl({ d: distance, method });

  return (
    <div className="app">
      <TopBar view={view} onView={setView} method={method} onMethod={setMethod} distance={distance} onDistance={setDistance}
              dataMode={health.status === "ok" ? health.data.data_mode : null} />
      <p className="sr-only" aria-live="polite">{selected ? `Selected: ${selected.a.name} and ${selected.b.name}, tier ${selected.tier ?? "none"}` : ""}</p>

      {view === "opportunities" && (
        <main className="workspace">
          <div className="col col--table">
            <div className="col-head">
              <h1 className="view-title">Coordination opportunities</h1>
              <ExportMenu briefUrl={selectedId ? api.briefUrl(selectedId, method) : null} csvUrl={csvUrl} />
            </div>
            <p className="muted small">{items.length} DESC × GPC pairs within {distance} mi ({method === "closest" ? "closest points" : "center-to-center, Sperry method"}), ranked by tier, timing, gap, distance.</p>
            {opps.status === "loading" && <Skeleton />}
            {opps.status === "error" && <ErrorCard message={opps.message} onRetry={retryOpps} />}
            {opps.status === "ok" && <OpportunityTable items={items} selectedId={selectedId} onSelect={setSelectedId} triage={triage} />}
          </div>
          <div className="col col--map">
            <MapView projects={projects.status === "ok" ? projects.data : []} opportunities={items} selectedId={selectedId}
                     method={method} onSelect={setSelectedId} />
            <MapLegend />
          </div>
          <div className="col col--detail">
            {detail.status === "loading" && selectedId && <Skeleton />}
            {detail.status === "error" && <ErrorCard message={detail.message} onRetry={retryDetail} />}
            {detail.status === "ok" && detail.data && (
              <DetailPanel detail={detail.data} triage={triage[detail.data.id] ?? "new"} onTriage={(t) => setTriage(detail.data!.id, t)} />
            )}
          </div>
        </main>
      )}
      {view === "changes" && (changes.status === "ok" ? <PlanChangesView changes={changes.data} />
        : changes.status === "error" ? <main className="view"><ErrorCard message={changes.message} onRetry={retryChanges} /></main> : <Skeleton />)}
      {view === "quality" && (quality.status === "ok" ? <DataQualityView quality={quality.data} />
        : quality.status === "error" ? <main className="view"><ErrorCard message={quality.message} onRetry={retryQuality} /></main> : <Skeleton />)}
    </div>
  );
}
