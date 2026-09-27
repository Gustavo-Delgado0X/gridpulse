import { PRECISION_TEXT } from "../format";
import type { Precision, Quality } from "../types";
import { InsetAlertCard } from "./InsetAlertCard";

const KIND_TAG: Record<string, string> = { coordinate_conflict: "COORDINATES DISAGREE", sources_disagree: "SOURCES DISAGREE" };

export function DataQualityView({ quality }: { quality: Quality }) {
  const { coverage, acceptance, discrepancies } = quality;
  return (
    <section className="view quality" aria-label="Data quality">
      <h1 className="view-title view-title--page">Data quality</h1>
      <div className="inverse-strip">
        <div><span className="strip__num mono">{coverage.projects}</span><span className="strip__label">PROJECTS PARSED</span></div>
        <div><span className="strip__num mono">{coverage.projects_located}</span><span className="strip__label">LOCATED</span></div>
        <div><span className="strip__num mono">{coverage.projects_unlocated}</span><span className="strip__label">NOT LOCATED</span></div>
        <div><span className="strip__num mono">{acceptance.passed ? `ANSWER KEY ${acceptance.matched}/${acceptance.expected} ✓` : `ANSWER KEY ${acceptance.matched}/${acceptance.expected} ✗`}</span>
          <span className="strip__label">SPERRY GATE A</span></div>
      </div>
      <div className="quality__grid">
        <section className="panel">
          <h2 className="panel-title">Location precision</h2>
          <table className="table table--compact">
            <thead><tr><th scope="col">Endpoint precision</th><th scope="col" className="num">Endpoints</th></tr></thead>
            <tbody>
              {Object.entries(coverage.endpoints_by_precision).map(([k, n]) => (
                <tr key={k}><td><span className="tag">{PRECISION_TEXT[k as Precision] ?? k}</span></td><td className="num mono">{n}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Unresolved endpoints are never guessed. Projects with no located endpoint are listed but not mapped.</p>
          <h2 className="panel-title">Answer-key check (center method)</h2>
          <table className="table table--compact">
            <thead><tr><th scope="col">Overlap</th><th scope="col" className="num">Sperry mi</th><th scope="col" className="num">Ours</th>
              <th scope="col" className="num">Gap</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {acceptance.details.map((d) => (
                <tr key={d.overlap_id}><td className="mono">{d.overlap_id}</td><td className="num mono">{d.expected_mi.toFixed(2)}</td>
                  <td className="num mono">{d.got_mi?.toFixed(2) ?? "—"}</td><td className="num mono">{d.got_gap ?? "—"}</td>
                  <td>{d.passed ? <span className="tag tag--ok">PASS</span> : <span className="tag tag--danger">FAIL</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2 className="panel-title">Discrepancies ({discrepancies.length})</h2>
          <div className="stack">
            {discrepancies.map((d, i) => (
              <InsetAlertCard key={`${d.project_id}-${i}`} tag={KIND_TAG[d.kind] ?? d.kind.toUpperCase()} title={d.message} tone="warn">
                <span className="mono">{d.project_id}</span>
              </InsetAlertCard>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
