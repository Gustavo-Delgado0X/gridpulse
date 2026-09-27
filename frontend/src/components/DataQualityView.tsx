import { useState } from "react";
import { pairsFor } from "../filters";
import type { Opportunity, Quality } from "../types";

const PROVENANCE: { key: string; label: string; tag: string; tone: "ok" | "neutral" | "warn" | "muted"; help: string }[] = [
  { key: "osm_feature", label: "OSM-resolved", tag: "Resolved", tone: "neutral", help: "Matched to a named OpenStreetMap substation" },
  { key: "approximate", label: "Approximate", tag: "Approximate", tone: "warn", help: "Endpoint proxy or regional approximation" },
  { key: "unresolved", label: "Unresolved", tag: "Unresolved", tone: "muted", help: "No safe match — intentionally not guessed" },
];
const ISSUE_TYPES = { all: "All", coordinate_conflict: "Coordinates", sources_disagree: "Source conflicts",
  cost_table_mismatch: "Cost tables", date_normalized: "Dates", id_reused: "Reused IDs" } as const;
const ISSUE_LABEL: Record<string, { text: string; warn: boolean }> = {
  coordinate_conflict: { text: "◇ Coordinate mismatch", warn: false },
  sources_disagree: { text: "▲ Source conflict", warn: true },
  cost_table_mismatch: { text: "◆ Cost table mismatch", warn: true },
  date_normalized: { text: "◇ Date normalized", warn: false },
  id_reused: { text: "≠ Project ID reused", warn: true },
};
const USES: Record<string, string> = {
  coordinate_conflict: "OpenStreetMap", cost_table_mismatch: "The Total column", date_normalized: "The normalized date shown",
  id_reused: "Not linked as a change",
};
type IssueFilter = keyof typeof ISSUE_TYPES;

interface Props {
  quality: Quality;
  opportunities?: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
}

const FINDING = /: (need date|IRP \d|OSM and|cost columns|in-service date|Project ID)/;

/** "Entity: finding" — entity names can contain colons ("SAV: GOSHEN…"), so split on the known finding phrases. */
export function splitIssue(message: string, entity?: string): [string, string] {
  if (entity) return [entity, message.startsWith(`${entity}: `) ? message.slice(entity.length + 2) : message];
  const match = FINDING.exec(message);
  return match ? [message.slice(0, match.index), message.slice(match.index + 2)] : [message, ""];
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((n) => (typeof n === "number" ? n.toFixed(5) : String(n))).join(", ");
  return String(v ?? "—");
}

const VALUE_LABEL: Record<string, string> = { osm: "OpenStreetMap", answer_key: "Sperry answer key", table_2: "IRP Table 2",
  detail_page: "IRP detail page", irp: "GPC IRP", sertp: "SERTP", columns_sum: "Cost columns sum", stated_total: "Total column",
  printed: "Printed", used: "Normalized to", before: "Earlier project", after: "Later project" };

export function DataQualityView({ quality, opportunities = [], onOpenOpportunity }: Props) {
  const { coverage, acceptance, independent, discrepancies } = quality;
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const counts = coverage.endpoints_by_precision;
  const bucket = (key: string) => key === "approximate" ? (counts.endpoint_proxy ?? 0) + (counts.regional_approximation ?? 0) : counts[key] ?? 0;
  const totalEndpoints = PROVENANCE.reduce((n, p) => n + bucket(p.key), 0) || 1;
  const locatedPct = Math.round((coverage.projects_located / coverage.projects) * 100);
  const issues = discrepancies.map((d, i) => ({ ...d, index: i }))
    .filter((d) => (filter === "all" || d.kind === filter) && (!query || `${d.message} ${d.project_id}`.toLowerCase().includes(query.toLowerCase())));

  return (
    <main className="page page--quality" aria-label="Data quality">
      <section className="toolbar">
        <div>
          <h1 className="page-title">Data quality</h1>
          <p className="muted small">{coverage.projects} projects · {discrepancies.length} issues · conservative: ambiguous or unmatched locations are left unresolved, not guessed</p>
        </div>
        <span className="spacer" />
        <dl className="health">
          <div><dd>{coverage.projects}</dd><dt>Projects parsed</dt></div>
          <div><dd>{coverage.projects_located} <span className="muted small">· {locatedPct}%</span></dd><dt>Located</dt></div>
          <div><dd>{coverage.projects_unlocated}</dd><dt>Not located · listed, not mapped</dt></div>
          <div className={acceptance.passed ? "is-ok" : "is-danger"}><dd>{acceptance.matched}/{acceptance.expected}</dd><dt>Validation passed</dt></div>
          {independent && <div className={independent.found === independent.expected ? "is-ok" : "is-warn"}>
            <dd>{independent.found}/{independent.expected}</dd><dt>Found · own locations</dt></div>}
          <div className="is-warn"><dd>{discrepancies.length}</dd><dt>Open issues</dt></div>
        </dl>
      </section>
      <div className="quality-layout">
        <div className="quality-left">
          <section className="block">
            <header className="block__head"><h2 className="panel-title">Location provenance</h2><span className="muted">{totalEndpoints} endpoints</span></header>
            <div className="stackbar" role="img" aria-label="Endpoint location provenance">
              {PROVENANCE.map((p) => <span key={p.key} className={`stackbar__seg tone--${p.tone}`} style={{ flexGrow: bucket(p.key) }} />)}
            </div>
            <ul className="prov-list">
              {PROVENANCE.filter((p) => bucket(p.key) > 0).map((p) => (
                <li key={p.key}>
                  <span className={`prov-dot tone--${p.tone}`} aria-hidden="true" />
                  <div><p><strong>{p.label}</strong> <span className={`prov-tag tone-text--${p.tone}`}>{p.tag}</span></p><p className="muted small">{p.help}</p></div>
                  <p className="prov-count"><strong>{bucket(p.key)}</strong> <span className="muted">{Math.round((bucket(p.key) / totalEndpoints) * 100)}%</span></p>
                </li>
              ))}
            </ul>
            <p className="muted small">Ambiguous or unmatched endpoints are left unresolved rather than guessed. Projects with no located endpoint remain listed but are not mapped — {coverage.projects_unlocated} of {coverage.projects} today.</p>
          </section>
          <section className="block">
            <header className="block__head"><h2 className="panel-title">Sperry answer-key benchmark</h2></header>
            <p className="muted small">The answer key is used only to check GridPulse, never as a location source.</p>
            <h3 className="section-title">Distance math <span className={acceptance.passed ? "tone-text--ok" : "tone-text--danger"}>
              {acceptance.matched} / {acceptance.expected} passed</span></h3>
            <p className="muted small">Center-to-center distances computed from the key's own coordinates. Tolerance ±0.01 mi.</p>
            <table className="mini-table" aria-label="Distance math on Sperry's coordinates">
              <thead><tr><th scope="col">Case</th><th scope="col" className="num">Expected</th><th scope="col" className="num">GridPulse</th>
                <th scope="col" className="num">Difference</th><th scope="col" className="num">In-service gap</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {acceptance.details.map((d) => (
                  <tr key={d.overlap_id}>
                    <td className="mono">{d.overlap_id}</td><td className="num">{d.expected_mi.toFixed(2)} mi</td>
                    <td className="num">{d.got_mi != null ? `${d.got_mi.toFixed(2)} mi` : "—"}</td>
                    <td className="num">{d.got_mi != null ? `${Math.abs(d.got_mi - d.expected_mi).toFixed(2)} mi` : "—"}</td>
                    <td className="num">{d.got_gap ?? "—"} d</td>
                    <td>{d.passed ? <span className="tone-text--ok">✓ Pass</span> : <span className="tone-text--danger">✗ Fail</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {independent && (
              <>
                <h3 className="section-title">With our own locations <span className={independent.found === independent.expected ? "tone-text--ok" : "tone-text--warn"}>
                  {independent.found} / {independent.expected} found</span></h3>
                <p className="muted small">The same pairs, measured on GridPulse's OpenStreetMap locations. Centers differ where an endpoint
                  (such as Okatie) is not in OpenStreetMap and stays unresolved.</p>
                <table className="mini-table" aria-label="Answer-key pairs found with GridPulse locations">
                  <thead><tr><th scope="col">Case</th><th scope="col" className="num">Key centers</th><th scope="col" className="num">Our centers</th>
                    <th scope="col" className="num">Our closest</th><th scope="col">Tier</th><th scope="col" className="num">In-service gap</th><th scope="col">Result</th></tr></thead>
                  <tbody>
                    {independent.details.map((d) => (
                      <tr key={d.overlap_id}>
                        <td className="mono">{d.overlap_id}</td><td className="num">{d.expected_mi.toFixed(2)} mi</td>
                        <td className="num">{d.got_center_mi != null ? `${d.got_center_mi.toFixed(2)} mi` : "—"}</td>
                        <td className="num">{d.touching ? "Touching" : d.got_closest_mi != null ? `${d.got_closest_mi.toFixed(2)} mi` : "—"}</td>
                        <td>{d.tier ?? "—"}</td><td className="num">{d.got_gap ?? "—"} d</td>
                        <td>{d.found ? <span className="tone-text--ok">✓ Found</span> : <span className="tone-text--danger">✗ Not found</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
        <section className="issues" aria-label="Issues">
          <header className="issues__head">
            <h2 className="panel-title">Issues</h2><span className="muted">{discrepancies.length} open</span>
            <div className="segmented" role="group" aria-label="Issue type">
              {(Object.keys(ISSUE_TYPES) as IssueFilter[]).map((k) => (
                <button key={k} type="button" className="segmented__item" aria-pressed={filter === k} onClick={() => setFilter(k)}>{ISSUE_TYPES[k]}</button>
              ))}
            </div>
            <span className="spacer" />
            <label className="search"><span className="search__icon" aria-hidden="true">⌕</span>
              <input type="search" placeholder="Search issues" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search issues" /></label>
          </header>
          <div className="issues__row issues__row--head"><span>Type</span><span>Entity and finding</span><span>Affected pairs</span>
            <span title="Status tracking has no backend yet">Status · proposed</span></div>
          {issues.map((d) => {
            const pairs = pairsFor(d.project_id, opportunities);
            const isOpen = expanded === d.index;
            return (
              <div key={d.index} className={`issue ${isOpen ? "is-open" : ""}`}>
                <button type="button" className="issues__row" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : d.index)}>
                  <span className={ISSUE_LABEL[d.kind]?.warn ? "tone-text--warn" : ""}>{ISSUE_LABEL[d.kind]?.text ?? d.kind}</span>
                  <span><strong>{splitIssue(d.message, d.endpoint)[0]}</strong><span className="issue__msg">{splitIssue(d.message, d.endpoint)[1]}</span>
                    <span className="mono muted small">{d.project_id}</span></span>
                  <span>{pairs.length ? `${pairs.length} ${pairs.length === 1 ? "pair" : "pairs"} affected` : <span className="muted">No ranked pair</span>}</span>
                  <span className="muted">Open</span>
                </button>
                {isOpen && (
                  <div className="issue__detail">
                    {d.values && (
                      <div className="compare__grid">
                        {Object.entries(d.values).map(([k, v]) => (
                          <div key={k} className="compare__cell"><span className="compare__label">{VALUE_LABEL[k] ?? k}</span><strong>{formatValue(v)}</strong></div>
                        ))}
                        <div className="compare__cell compare__cell--used"><span className="compare__label">GridPulse uses</span>
                          <strong>{USES[d.kind] ?? (d.values.table_2 ? "IRP Table 2" : "GPC IRP")}</strong></div>
                      </div>
                    )}
                    <div className="issue__actions">
                      {pairs.slice(0, 4).map((o) => (
                        <button key={o.id} type="button" className="btn" onClick={() => onOpenOpportunity?.(o.id)}>Pair #{o.rank} · {o.tier ?? "—"} →</button>
                      ))}
                      <span className="btn btn--proposed" aria-disabled="true" title="No backend support yet">Mark reviewed · proposed</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
