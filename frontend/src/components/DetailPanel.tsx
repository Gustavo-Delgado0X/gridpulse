import { useState, type KeyboardEvent } from "react";
import { FLAG_TEXT, formatDate, formatMiles, TIMING_TEXT } from "../format";
import type { OpportunityDetail, Project, Triage } from "../types";
import { CostEstimator, initialDraft, type EstimatorDraft } from "./CostEstimator";
import { EvidenceItem } from "./EvidenceItem";
import { InsetAlertCard } from "./InsetAlertCard";
import { PrecisionTag } from "./PrecisionTag";
import { TierBadge } from "./TierBadge";
import { TimelineStrip } from "./TimelineStrip";
import { TriageControl } from "./TriageControl";
import { UtilityChip } from "./UtilityChip";

const FLAG_HELP: Record<string, string> = {
  method_disagree: "Sperry's center-to-center rule and the closest-point rule give different answers at 25 mi.",
  low_confidence_location: "At least one endpoint is approximate. Verify before contacting the other utility.",
  sources_disagree: "The source documents give conflicting dates for a project in this pair (see Plan changes).",
};

type Tab = "overview" | "estimate" | "evidence";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "OVERVIEW" }, { id: "estimate", label: "ESTIMATE" }, { id: "evidence", label: "EVIDENCE" },
];

interface Props {
  detail: OpportunityDetail;
  triage: Triage;
  onTriage: (next: Triage) => void;
  /** Builds the printable-brief URL from the estimator query string. */
  briefUrl: (query: string) => string;
}

function ProjectCard({ project, mapsLink }: { project: Project; mapsLink: string | null }) {
  return (
    <article className="project-card">
      <header><UtilityChip utility={project.utility} /> <span className="mono muted">{project.id}</span>
        {project.answer_key_id && <span className="tag tag--muted tag--xs">KEY {project.answer_key_id}</span>}</header>
      <h3 className="project-card__name">{project.name}</h3>
      <dl className="kv">
        <div><dt>In service</dt><dd className="mono">{formatDate(project.in_service_date)}</dd></div>
        <div><dt>Window</dt><dd className="mono">{project.window_start ? `${project.window_start} → ${project.window_end}` : "not published"}</dd></div>
        {project.voltage_kv && <div><dt>Voltage</dt><dd className="mono">{project.voltage_kv} kV</dd></div>}
        {project.status && <div><dt>Status</dt><dd>{project.status}</dd></div>}
      </dl>
      <ul className="endpoints">
        {project.endpoints.map((e) => (
          <li key={e.id}><PrecisionTag precision={e.precision} /> {e.name_raw}
            {e.osm_name && e.osm_name !== e.name_raw && <span className="muted"> ({e.osm_name})</span>}</li>
        ))}
      </ul>
      {mapsLink && <a className="link mono" href={mapsLink} target="_blank" rel="noreferrer">Open in maps ↗</a>}
    </article>
  );
}

export function DetailPanel({ detail, triage, onTriage, briefUrl }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState<EstimatorDraft>(() => initialDraft(detail.estimator.inputs));
  const facts = detail.evidence.filter((e) => e.type !== "interpretation");
  const interpretation = detail.evidence.find((e) => e.type === "interpretation");
  const query = new URLSearchParams(draft).toString();

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const index = (TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length;
    setTab(TABS[index].id);
    (event.currentTarget.parentElement?.children[index] as HTMLElement | undefined)?.focus();
  };

  return (
    <section className="panel detail" aria-label="Selected opportunity">
      <header className="detail__head">
        <span className="mono muted">#{detail.rank}</span>
        <TierBadge tier={detail.tier} />
        <span className={`timing timing--${detail.timeline_label}`}>{TIMING_TEXT[detail.timeline_label]}</span>
        <a className="btn btn--pill btn--sm detail__export" href={briefUrl(query)} target="_blank" rel="noreferrer">Export brief</a>
      </header>
      <h2 className="detail__title">
        <span className="detail__side"><UtilityChip utility={detail.a.utility} /> {detail.a.name}</span>
        <span className="detail__side"><UtilityChip utility={detail.b.utility} /> {detail.b.name}</span>
      </h2>
      <div className="distances">
        <div className={detail.method === "closest" ? "is-active" : ""}><span className="field__label">Closest points</span>
          <span className="mono big">{formatMiles(detail.dist_closest_mi, detail.touching)}</span></div>
        <div className={detail.method === "center" ? "is-active" : ""}><span className="field__label">Centers (Sperry)</span>
          <span className="mono big">{formatMiles(detail.dist_center_mi)}</span></div>
      </div>
      <div className="tabs-inline" role="tablist" aria-label="Detail sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1} className="tab-inline" onClick={() => setTab(t.id)} onKeyDown={onTabKey}>
            {t.label}{t.id === "evidence" && <span className="tab-count mono" aria-hidden="true"> {facts.length}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="detail__body">
        {tab === "overview" && (
          <>
            {interpretation && <p className="interpretation"><span className="tag tag--muted tag--xs">{interpretation.label}</span> <em>{interpretation.quote}</em></p>}
            {detail.flags.map((f) => <InsetAlertCard key={f} tag={FLAG_TEXT[f] ?? f.toUpperCase()} title={FLAG_HELP[f] ?? f} tone="warn" />)}
            <div className="field"><span className="field__label">Triage</span><TriageControl value={triage} onChange={onTriage} /></div>
            <TimelineStrip opportunity={detail} />
            <div className="project-pair">
              <ProjectCard project={detail.project_a} mapsLink={detail.maps_links.a} />
              <ProjectCard project={detail.project_b} mapsLink={detail.maps_links.b} />
            </div>
          </>
        )}
        {tab === "estimate" && <CostEstimator inputs={detail.estimator.inputs} draft={draft} onDraft={setDraft} />}
        {tab === "evidence" && (
          <section aria-label="Evidence">
            <p className="muted small">Verbatim quotes with source page. DERIVED values name their method.</p>
            <ul className="evidence-list">{facts.map((e) => <EvidenceItem key={e.id} item={e} />)}</ul>
          </section>
        )}
      </div>
    </section>
  );
}
