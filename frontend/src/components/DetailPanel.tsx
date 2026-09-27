import { FLAG_TEXT, formatDate, formatMiles, TIMING_TEXT } from "../format";
import type { OpportunityDetail, Project, Triage } from "../types";
import { CostEstimator } from "./CostEstimator";
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
  sources_disagree: "The source documents give conflicting values for this project.",
};

interface Props {
  detail: OpportunityDetail;
  triage: Triage;
  onTriage: (next: Triage) => void;
}

function ProjectCard({ project, mapsLink }: { project: Project; mapsLink: string | null }) {
  return (
    <article className="project-card">
      <header><UtilityChip utility={project.utility} /> <span className="mono muted">{project.id}</span>
        {project.answer_key_id && <span className="tag tag--muted">KEY {project.answer_key_id}</span>}</header>
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

export function DetailPanel({ detail, triage, onTriage }: Props) {
  const facts = detail.evidence.filter((e) => e.type !== "interpretation");
  const interpretation = detail.evidence.find((e) => e.type === "interpretation");
  return (
    <section className="panel detail" aria-label="Selected opportunity">
      <header className="detail__head">
        <span className="mono muted">#{detail.rank}</span>
        <TierBadge tier={detail.tier} />
        <span className={`timing timing--${detail.timeline_label}`}>{TIMING_TEXT[detail.timeline_label]}</span>
      </header>
      <div className="distances">
        <div><span className="field__label">Closest points</span><span className="mono big">{formatMiles(detail.dist_closest_mi, detail.touching)}</span></div>
        <div><span className="field__label">Centers (Sperry)</span><span className="mono big">{formatMiles(detail.dist_center_mi)}</span></div>
      </div>
      {interpretation && <p className="interpretation"><span className="tag tag--muted">{interpretation.label}</span> <em>{interpretation.quote}</em></p>}
      {detail.flags.map((f) => (
        <InsetAlertCard key={f} tag={FLAG_TEXT[f] ?? f.toUpperCase()} title={FLAG_HELP[f] ?? f} tone="warn" />
      ))}
      <TriageControl value={triage} onChange={onTriage} />
      <div className="project-pair">
        <ProjectCard project={detail.project_a} mapsLink={detail.maps_links.a} />
        <ProjectCard project={detail.project_b} mapsLink={detail.maps_links.b} />
      </div>
      <TimelineStrip opportunity={detail} />
      <CostEstimator key={detail.id} inputs={detail.estimator.inputs} />
      <section aria-label="Evidence">
        <header className="section-head"><span className="tag">EVIDENCE</span><span className="muted small">verbatim quotes with source page</span></header>
        <ul className="evidence-list">{facts.map((e) => <EvidenceItem key={e.id} item={e} />)}</ul>
      </section>
    </section>
  );
}
