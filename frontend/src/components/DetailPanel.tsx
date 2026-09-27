import { useState, type KeyboardEvent } from "react";
import { FLAG_TEXT, TIER_TEXT, TIMING_TEXT } from "../format";
import type { Change, OpportunityDetail, Project, Triage } from "../types";
import { CostEstimator, initialDraft, type EstimatorDraft } from "./CostEstimator";
import { EVIDENCE_GLYPH, EvidenceItem } from "./EvidenceItem";
import { TIER_RANGE } from "./OpportunityTable";
import { Popover } from "./Popover";
import { PrecisionTag } from "./PrecisionTag";
import { TierBadge } from "./TierBadge";
import { TimelineStrip, type PriorDate } from "./TimelineStrip";
import { TriageControl } from "./TriageControl";
import { UtilityChip } from "./UtilityChip";

const FLAG_HELP: Record<string, string> = {
  method_disagree: "Sperry's center-to-center rule and the closest-point rule give different answers at 25 mi.",
  low_confidence_location: "At least one endpoint is approximate. Verify before contacting the other utility.",
  sources_disagree: "The source documents give conflicting dates for a project in this pair.",
};
const FLAG_TITLE: Record<string, string> = {
  sources_disagree: "Source conflict detected", method_disagree: "Distance methods disagree", low_confidence_location: "Approximate location",
};
const UTILITY_NAME = { DESC: "Dominion Energy SC", GPC: "Georgia Power", other_utility: "Other utility" } as const;
const SCHEDULE_EVENTS = new Set(["slipped", "moved_earlier"]);
const COMPARE_EVENTS = new Set(["slipped", "moved_earlier", "sources_disagree", "cost_changed", "renamed"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Tab = "overview" | "timeline" | "estimate" | "evidence";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "timeline", label: "Timeline" }, { id: "estimate", label: "Estimate" }, { id: "evidence", label: "Evidence" },
];
const title = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();

interface Props {
  detail: OpportunityDetail;
  triage: Triage;
  onTriage: (next: Triage) => void;
  /** Builds the printable-brief URL from the estimator query string. */
  briefUrl: (query: string) => string;
  changes?: Change[];
  onHoverProject?: (projectId: string | null) => void;
  onViewChanges?: (projectId: string) => void;
}

function ProjectFacts({ project, mapsLink }: { project: Project; mapsLink: string | null }) {
  return (
    <section className="facts" aria-label={`${project.utility} project details`}>
      <h4 className="facts__title"><UtilityChip utility={project.utility} /> <span className="mono muted">{project.id}</span>
        {project.answer_key_id && <span className="badge-soft">Answer key {project.answer_key_id}</span>}</h4>
      <dl className="dl">
        <dt>In service</dt><dd>{project.in_service_date}</dd>
        <dt>Build window</dt><dd>{project.window_start ? `${project.window_start} → ${project.window_end}` : "Not published"}
          {project.window_method === "desc_cost_schedule" && <span className="muted"> · estimated from spend years</span>}
          {project.window_method === "gpc_start_need" && <span className="muted"> · published start → need date</span>}</dd>
        {project.voltage_kv && <><dt>Voltage</dt><dd>{project.voltage_kv} kV</dd></>}
        {project.status && <><dt>Status</dt><dd>{project.status}</dd></>}
        <dt>Endpoints</dt>
        <dd>{project.endpoints.map((e) => (
          <span key={e.id} className="endpoint"><PrecisionTag precision={e.precision} /> {e.name_raw}
            {e.precision === "osm_feature" && <span className="muted small">{e.confirmed_by_pdf_context ? " · context confirmed" : " · name match only"}</span>}</span>))}</dd>
      </dl>
      {mapsLink && <a className="link" href={mapsLink} target="_blank" rel="noreferrer">Open in maps ↗</a>}
    </section>
  );
}

/** One cell per cited source. The cell from the list GridPulse ranks on (the project's own source) is marked as used. */
function Compare({ change, rankedSource }: { change: Change; rankedSource: string }) {
  const values = [change.before, change.after];
  const heading = change.event === "sources_disagree" ? "Sources disagree"
    : change.event === "id_reused" ? "Project ID reused for a different project" : `${title(change.event.replace("_", " "))} between plan versions`;
  return (
    <div className="compare">
      <p className="compare__title">{heading}</p>
      <div className="compare__grid">
        {change.evidence.map((e, i) => {
          const used = e.source_id === rankedSource;
          return (
            <div key={`${e.source_id}-${i}`} className={`compare__cell ${used ? "compare__cell--used" : ""}`}>
              <span className="compare__label">{used ? "Used by GridPulse" : `${i < change.evidence.length - 1 ? "Earlier" : "Later"} plan · ${e.source_id} p.${e.page}`}</span>
              <strong>{e.quote}</strong>
              {used && <span className="mono">{e.source_id} · p.{e.page}</span>}
              {!used && values[i] && values[i] !== e.quote && <span className="muted small">{values[i]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DetailPanel({ detail, triage, onTriage, briefUrl, changes = [], onHoverProject, onViewChanges }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState<EstimatorDraft>(() => initialDraft(detail.estimator.inputs));
  const facts = detail.evidence.filter((e) => e.type === "fact");
  const derived = detail.evidence.filter((e) => e.type === "derived");
  const interpretation = detail.evidence.find((e) => e.type === "interpretation");
  const query = new URLSearchParams(draft).toString();
  const linkedTo = (c: Change) => c.primary_id ?? c.project_id;
  const pairChanges = changes.filter((c) => linkedTo(c) === detail.a.id || linkedTo(c) === detail.b.id);
  const scheduleChanges = pairChanges.filter((c) => SCHEDULE_EVENTS.has(c.event));
  const usedDate = (projectId: string) => (projectId === detail.a.id ? detail.project_a : detail.project_b).in_service_date;
  const priorDates: PriorDate[] = pairChanges
    .filter((c) => SCHEDULE_EVENTS.has(c.event) && c.after && ISO.test(c.after) && c.after !== usedDate(linkedTo(c)))
    .map((c) => ({ projectId: linkedTo(c), date: c.after!, label: `Later plan (${c.evidence[c.evidence.length - 1]?.source_id ?? "source"})` }));
  const closestActive = detail.method === "closest";
  const distanceText = detail.touching ? "touching at a shared facility" : `${detail.dist_closest_mi.toFixed(2)} mi at closest points`;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const index = (TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length;
    setTab(TABS[index].id);
    (event.currentTarget.parentElement?.children[index] as HTMLElement | undefined)?.focus();
  };

  const projectHeader = (p: Project, shape: "circle" | "square") => (
    <div className="pair-card__project" onMouseEnter={() => onHoverProject?.(p.id)} onMouseLeave={() => onHoverProject?.(null)}>
      <span className={`shape shape--${shape} chip--${p.utility} shape--lg`} aria-hidden="true" />
      <div>
        <h3 className="pair-card__name">{p.name}</h3>
        <p className="muted">{UTILITY_NAME[p.utility]} · <span className="mono">{p.id}</span></p>
      </div>
    </div>
  );

  return (
    <section className="inspector" aria-label="Selected opportunity">
      <header className="inspector__head">
        <span className="muted rank">#{String(detail.rank).padStart(2, "0")}</span>
        <TierBadge tier={detail.tier} compact />
        {detail.tier && <span className="muted">{TIER_RANGE[detail.tier]}</span>}
        <span className="spacer" />
        <TriageControl value={triage} onChange={onTriage} />
        <a className="btn btn--primary" href={briefUrl(query)} target="_blank" rel="noreferrer">Export brief</a>
        <Popover label="⋯" ariaLabel="More actions" align="right" className="popover--bare">
          {(close) => (
            <div className="menu">
              <button type="button" className="menu__item" onClick={() => { void navigator.clipboard?.writeText(window.location.href); close(); }}>Copy link to this pair</button>
              {detail.maps_links.a && <a className="menu__item" href={detail.maps_links.a} target="_blank" rel="noreferrer">Open DESC site in maps ↗</a>}
              {detail.maps_links.b && <a className="menu__item" href={detail.maps_links.b} target="_blank" rel="noreferrer">Open GPC site in maps ↗</a>}
            </div>
          )}
        </Popover>
      </header>

      <div className="inspector__scroll">
        <p className="recommendation"><span aria-hidden="true">◆</span> <strong>{detail.tier ? title(TIER_TEXT[detail.tier]) : "Beyond the tier table"}</strong>
          <span className="muted"> · {title(TIMING_TEXT[detail.timeline_label])}</span></p>

        <div className="pair-card">
          {projectHeader(detail.project_a, "circle")}
          <p className="pair-card__link"><span aria-hidden="true" className="pair-card__rule" />{distanceText}</p>
          {projectHeader(detail.project_b, "square")}
        </div>

        <dl className="stats">
          <div className={closestActive ? "is-active" : ""}><dt>Closest</dt><dd>{detail.touching ? "Touching" : `${detail.dist_closest_mi.toFixed(2)} mi`}</dd></div>
          <div className={closestActive ? "" : "is-active"}><dt>Centers</dt><dd>{detail.dist_center_mi.toFixed(2)} mi</dd></div>
          <div><dt>Overlap</dt><dd>{detail.window_overlap_days ? `${detail.window_overlap_days} d` : "None"}</dd></div>
          <div><dt>In-service gap</dt><dd>{detail.in_service_gap_days} d</dd></div>
        </dl>

        {scheduleChanges.length > 0 && (
          <div className="alert alert--warn" role="note">
            <p className="alert__title">▲ Schedule changed in later plan versions</p>
            <p>{scheduleChanges.map((c) => `${c.name}: ${c.before} → ${c.after}`).join("; ")}. GridPulse ranks on DESC 2024–28, the
              list Sperry's answer key uses; later dates are shown for review.</p>
            <p className="alert__actions">
              <button type="button" className="link-btn" onClick={() => setTab("evidence")}>Review conflicting sources →</button>
              {onViewChanges && <button type="button" className="link-btn" onClick={() => onViewChanges(linkedTo(scheduleChanges[0]))}>View plan change</button>}
            </p>
          </div>
        )}
        {detail.flags.map((f) => (
          <div key={f} className="alert alert--warn" role="note">
            <p className="alert__title">▲ {FLAG_TITLE[f] ?? FLAG_TEXT[f] ?? f}</p>
            <p>{FLAG_HELP[f] ?? f}</p>
            {f === "sources_disagree" && (
              <p className="alert__actions">
                <button type="button" className="link-btn" onClick={() => setTab("evidence")}>Review conflicting sources →</button>
                {onViewChanges && pairChanges.some((c) => c.event === "sources_disagree") && (
                  <button type="button" className="link-btn" onClick={() => onViewChanges(linkedTo(pairChanges.find((c) => c.event === "sources_disagree")!))}>View plan change</button>
                )}
              </p>
            )}
          </div>
        ))}

        <div className="tabs-inline" role="tablist" aria-label="Detail sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
                    tabIndex={tab === t.id ? 0 : -1} className="tab-inline" onClick={() => setTab(t.id)} onKeyDown={onTabKey}>
              {t.label}{t.id === "evidence" && <span className="tab-count" aria-hidden="true"> {facts.length}</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="inspector__body">
          {tab === "overview" && (
            <>
              {interpretation && (
                <section>
                  <h4 className="section-title" title={`${interpretation.label}: generated from the facts, not an AI summary`}>◆ Coordination rationale</h4>
                  <p className="rationale">{interpretation.quote}</p>
                </section>
              )}
              <section>
                <h4 className="section-title">Build windows <button type="button" className="link-btn" onClick={() => setTab("timeline")}>Full timeline</button></h4>
                <TimelineStrip opportunity={detail} priorDates={priorDates} />
              </section>
              <ProjectFacts project={detail.project_a} mapsLink={detail.maps_links.a} />
              <ProjectFacts project={detail.project_b} mapsLink={detail.maps_links.b} />
            </>
          )}
          {tab === "timeline" && <TimelineStrip opportunity={detail} variant="full" priorDates={priorDates} />}
          {tab === "estimate" && <CostEstimator inputs={detail.estimator.inputs} draft={draft} onDraft={setDraft} />}
          {tab === "evidence" && (
            <section aria-label="Evidence">
              {[detail.project_a, detail.project_b].map((p) => {
                const own = facts.filter((e) => e.project_id === p.id);
                const conflicts = pairChanges.filter((c) => linkedTo(c) === p.id && COMPARE_EVENTS.has(c.event));
                return (
                  <div key={p.id} className="evidence-group">
                    <h4 className="section-title"><UtilityChip utility={p.utility} /> {UTILITY_NAME[p.utility]} · <span className="mono">{p.id}</span></h4>
                    {conflicts.map((c, i) => <Compare key={`${c.event}-${i}`} change={c} rankedSource={p.source_id} />)}
                    <ul className="evidence-list">{own.map((e) => <EvidenceItem key={e.id} item={e} />)}</ul>
                  </div>
                );
              })}
              <div className="evidence-group">
                <h4 className="section-title">Derived by GridPulse</h4>
                <ul className="evidence-list">{derived.map((e) => <EvidenceItem key={e.id} item={e} />)}</ul>
              </div>
              <p className="evidence-legend small muted">
                <span>{EVIDENCE_GLYPH.fact} Source fact</span><span>{EVIDENCE_GLYPH.derived} Derived</span><span>{EVIDENCE_GLYPH.interpretation} Assessment</span>
              </p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
