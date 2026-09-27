import { WORKSPACE_PATH } from "../route";
import { toHash } from "../urlState";
import type { Opportunity, Quality } from "../types";

export interface LandingStats {
  projects: number | null;
  pairs: number | null;
  changes: number | null;
  acceptance: Quality["acceptance"] | null;
}

export interface SourceFact {
  name: string;
  printed: string;
  source_id: string;
  page: number;
}

interface Props {
  stats: LandingStats;
  featured?: Opportunity | null;
  quality?: Quality | null;
  conflict?: { message: string; project_id: string } | null;
  /** The featured DESC project's in-service date exactly as printed in the list GridPulse ranks on. */
  sourceFact?: SourceFact | null;
}

const PENDING = "—";
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const month = (iso: string) => MONTH.format(new Date(`${iso}T00:00:00Z`));

/** The build-window intersection of the featured pair, e.g. "Jun 2025 → Dec 2025". */
export function overlapRange(o: Opportunity | null | undefined): string | null {
  const [a, b] = o ? [o.a, o.b] : [];
  if (!a?.window_start || !a.window_end || !b?.window_start || !b.window_end || !o?.window_overlap_days) return null;
  const start = a.window_start > b.window_start ? a.window_start : b.window_start;
  const end = a.window_end < b.window_end ? a.window_end : b.window_end;
  return `${month(start)} → ${month(end)}`;
}

function coordLabel(o: Opportunity | null | undefined): string {
  if (!o) return "SAVANNAH / AUGUSTA STUDY AREA";
  const [[lat1, lon1], [lat2, lon2]] = o.closest_points;
  return `${((lat1 + lat2) / 2).toFixed(2)}°N ${Math.abs((lon1 + lon2) / 2).toFixed(2)}°W · FEATURED PAIR`;
}

const FEATURED_ID = "desc-2428-6367-d-g__gpc-20065";
const REPO_URL = "https://github.com/Gustavo-Delgado0X/gridpulse";

const dots = (pattern: string) => pattern.split("").map((c, i) => <span key={i} className={c === "1" ? "on" : ""} />);

const PROBLEMS = [
  { h: "Plans are PDFs, not data", b: "Hundreds of pages of project tables and detail sheets, each utility in its own format, some fields redacted.", p: "101010101" },
  { h: "Neighbours plan blind", b: "DESC and Georgia Power schedule work within a few miles of each other across the Savannah River, on overlapping build windows.", p: "110110000" },
  { h: "Schedules drift between versions", b: "In-service dates slip and costs move from one edition to the next, and the tables rarely agree with their own detail pages.", p: "100010001" },
  { h: "Locations are ambiguous", b: "Substations are named, not placed. The same endpoint can appear with two coordinates a third of a mile apart.", p: "010111010" },
];

const STEPS = [
  { n: "01", h: "Detect plan changes", b: "Compare plan editions project by project: slipped dates, cost changes, renames, and tables that disagree with their detail pages." },
  { n: "02", h: "Validate the data", b: "Resolve endpoints conservatively — Sperry-confirmed, OSM-resolved, or unresolved — and benchmark distances against the answer key." },
  { n: "03", h: "Rank opportunities", b: "Measure every DESC × GPC pair at closest points and centers, tier it from touching to under 25 mi, and weigh build-window overlap." },
  { n: "04", h: "Trace to evidence", b: "Open any pair to see the rationale, the timeline, and each quoted field with its source document and page." },
];

function layers(pair: Opportunity | null, fact: SourceFact | null | undefined) {
  const miles = pair ? (pair.touching ? "touching" : `${pair.dist_closest_mi.toFixed(2)} mi apart`) : PENDING;
  return [
    { tag: "Source fact", glyph: "fact",
      claim: fact ? `${fact.name.replace(/:.*$/, "")} planned in-service: ${fact.printed}` : PENDING,
      src: fact ? `${fact.source_id} · p.${fact.page} · quoted as printed` : "loading" },
    { tag: "Derived", glyph: "derived",
      claim: pair ? `Closest points ${miles}; build windows overlap by ${pair.window_overlap_days ?? 0} days.` : PENDING,
      src: "computed · geodesic closest points (nearest points found in EPSG:5070)" },
    { tag: "Assessment", glyph: "assessment", claim: "Tier T3 — shared logistics worth reviewing. Candidate for human review.",
      src: "GridPulse rationale · labelled as such" },
  ];
}

const fmt = (n: number | null | undefined) => (n == null ? PENDING : String(n));

function Schematic() {
  return (
    <svg className="schematic" viewBox="0 0 540 460" role="img" aria-label="Schematic: the Jasper–Okatie DESC line and the Goshen–McIntosh GPC line, 3.40 miles apart across the Savannah River">
      <defs>
        <pattern id="lp-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="var(--line-soft)" /></pattern>
      </defs>
      <rect width="540" height="460" fill="url(#lp-grid)" />
      <text x="16" y="26" className="schematic__caption">SCHEMATIC · NOT TO SCALE</text>
      <path d="M236 45 C 250 150, 262 190, 270 220 S 300 320, 330 390 S 360 450, 368 460" fill="none" stroke="var(--line-hairline)" strokeWidth="9" strokeLinecap="round" />
      <g stroke="#b9b4ac" strokeWidth="1.5">
        <line x1="338" y1="70" x2="372" y2="125" /><line x1="102" y1="285" x2="158" y2="308" /><line x1="158" y1="308" x2="180" y2="374" />
        <line x1="430" y1="285" x2="474" y2="340" />
      </g>
      <line x1="221" y1="178" x2="198" y2="340" stroke="var(--text-primary)" strokeWidth="2" />
      <line x1="268" y1="171" x2="338" y2="191" stroke="var(--text-primary)" strokeWidth="2" />
      <line x1="338" y1="191" x2="415" y2="211" stroke="var(--text-primary)" strokeWidth="2" />
      <line x1="221" y1="178" x2="268" y2="171" stroke="var(--text-primary)" strokeWidth="1.5" strokeDasharray="4 3" />
      <rect x="215" y="172" width="12" height="12" fill="var(--text-primary)" /><rect x="192" y="334" width="12" height="12" fill="var(--text-primary)" />
      <circle cx="268" cy="171" r="6" fill="var(--text-primary)" /><circle cx="338" cy="191" r="4" fill="var(--text-primary)" /><circle cx="415" cy="211" r="6" fill="var(--text-primary)" />
      <rect x="233" y="141" width="54" height="20" rx="3" fill="var(--text-primary)" /><text x="260" y="155" textAnchor="middle" className="schematic__pill">3.40 mi</text>
      <text x="152" y="162" className="schematic__label">McIntosh</text><text x="272" y="200" className="schematic__label">Okatie</text>
      <text x="152" y="358" className="schematic__label">Goshen</text>
      <circle cx="21" cy="422" r="3.5" fill="var(--text-primary)" /><text x="30" y="426" className="schematic__legend">DESC</text>
      <rect x="17.5" y="438" width="7" height="7" fill="var(--text-primary)" /><text x="30" y="445" className="schematic__legend">Georgia Power</text>
    </svg>
  );
}

export function Landing({ stats, featured, quality, conflict, sourceFact }: Props) {
  const acceptance = stats.acceptance;
  const pair = featured ?? null;
  const studyHref = `${WORKSPACE_PATH}${toHash({ pair: pair?.id ?? FEATURED_ID, method: "closest", d: 25 })}`;
  const precision = quality?.coverage.endpoints_by_precision;
  const count = (key: string) => (precision ? String(precision[key] ?? 0) : PENDING);
  const bench = acceptance?.details.map((d) => ({ id: d.overlap_id, expected: d.expected_mi, got: d.got_mi, gap: d.got_gap, passed: d.passed })) ?? [];
  const overlap = overlapRange(pair);
  const proof = [
    { n: fmt(stats.projects), l: "projects parsed from public plans" },
    { n: fmt(stats.pairs), l: "DESC × GPC pairs within 25 mi" },
    { n: fmt(stats.changes), l: "changes detected between plan versions" },
    { n: acceptance ? `${acceptance.matched} / ${acceptance.expected}` : PENDING, l: "Sperry answer-key overlaps reproduced" },
  ];

  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <a className="lp-brand" href="/"><span aria-hidden="true">◆</span> GridPulse</a>
          <nav aria-label="Sections" className="lp-nav__links">
            <a href="#problem">Problem</a><a href="#how">How it works</a><a href="#evidence">Evidence</a><a href="#validation">Validation</a>
          </nav>
          <a className="lp-btn lp-btn--ghost" href={WORKSPACE_PATH}>Open the workspace</a>
        </div>
      </header>

      <main id="main">
        <section className="lp-wrap lp-hero">
          <div className="lp-hero__copy">
            <p className="lp-eyebrow">DESC × Georgia Power · Savannah / Augusta</p>
            <p className="lp-hero__kicker">Two utilities. One corridor. Separate plans.</p>
            <h1 className="lp-hero__title">GridPulse finds where transmission plans meet — before the crews do.</h1>
            <p className="lp-hero__lede">GridPulse reads Dominion Energy SC and Georgia Power transmission plans, ranks the project pairs that should talk to
              each other, and traces every distance, date and dollar back to its source page.</p>
            <div className="lp-actions">
              <a className="lp-btn lp-btn--primary" href={studyHref}>Open the Savannah / Augusta study</a>
              <a className="lp-btn lp-btn--ghost" href="#how">See how it works</a>
            </div>
          </div>
          <div className="lp-hero__visual" aria-label="Example from the study">
            <p className="lp-hero__coords">{coordLabel(pair)}</p>
            <figure className="lp-card lp-card--pair" aria-label="Example opportunity">
              <div className="lp-card__head"><span className="lp-tierchip">{pair?.tier ?? "T3"} · SHARE LOGISTICS</span>
                <span className="lp-muted">#{pair ? String(pair.rank).padStart(2, "0") : PENDING} of {fmt(stats.pairs)}</span></div>
              <p className="lp-card__proj"><span className="lp-shape lp-shape--circle" aria-hidden="true" /><span className="lp-code">DESC</span>{pair?.a.name ?? PENDING}</p>
              <p className="lp-card__proj"><span className="lp-shape lp-shape--square" aria-hidden="true" /><span className="lp-code">GPC</span>{pair?.b.name ?? PENDING}</p>
              <dl className="lp-card__stats">
                <div><dd>{pair ? `${pair.dist_closest_mi.toFixed(2)} mi` : PENDING}</dd><dt>closest</dt></div>
                <div><dd>{pair ? `${pair.dist_center_mi.toFixed(2)} mi` : PENDING}</dd><dt>centers</dt></div>
                <div><dd>{pair ? `${pair.in_service_gap_days} d` : PENDING}</dd><dt>in-service gap</dt></div>
              </dl>
            </figure>
            <figure className="lp-card lp-card--alert" aria-label="Example data-quality finding">
              <p className="lp-card__title">Sources disagree</p>
              <p>{conflict?.message ?? PENDING}</p>
              <p className="lp-mono lp-muted">{conflict?.project_id ?? ""}</p>
            </figure>
          </div>
        </section>

        <section className="lp-proof" aria-label="At a glance">
          <div className="lp-wrap lp-proof__grid">
            {proof.map((p) => <div key={p.l}><p className="lp-proof__n">{p.n}</p><p className="lp-muted">{p.l}</p></div>)}
          </div>
        </section>

        <section id="problem" className="lp-dark">
          <div className="lp-wrap">
            <p className="lp-eyebrow lp-eyebrow--dark">Problem</p>
            <h2 className="lp-h2">Neighbouring utilities publish their plans in isolation — and build within miles of each other anyway.</h2>
            <div className="lp-problems">
              {PROBLEMS.map((p) => (
                <div key={p.h} className="lp-problem">
                  <span className="lp-dots" aria-hidden="true">{dots(p.p)}</span>
                  <div><h3>{p.h}</h3><p>{p.b}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="lp-wrap lp-section">
          <p className="lp-eyebrow">How it works</p>
          <div className="lp-split lp-split--head">
            <h2 className="lp-h2">Detect the change. Check the data. Rank the pair. Show the page.</h2>
            <p className="lp-lede">One pipeline, three views. Plan changes feed data quality; data quality decides how far to trust each opportunity;
              every opportunity opens onto its evidence.</p>
          </div>
          <div className="lp-split">
            <div className="lp-schematic">
              <Schematic />
              <div className="lp-card lp-card--float"><p className="lp-card__title">Build windows overlap · {pair?.window_overlap_days ?? PENDING} days</p>
                <p className="lp-muted">{overlap ?? PENDING}. Shared staging and outages worth reviewing.</p></div>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s) => <li key={s.n}><span className="lp-mono lp-muted">{s.n}</span><div><h3>{s.h}</h3><p>{s.b}</p></div></li>)}
            </ol>
          </div>
          <div className="lp-views">
            <article>
              <div className="lp-mini">
                <p className="lp-muted small">#04 <span className="lp-badge">T3</span> &lt; 5 mi · Share logistics</p>
                <p><span className="lp-code">DESC</span> Jasper – Okatie 230 kV #2</p><p><span className="lp-code">GPC</span> SAV: Goshen – McIntosh 115 kV</p>
                <p><strong>3.40 mi</strong> <span className="lp-muted">closest · 213-day overlap</span></p>
                <p className="lp-warn small">▲ Source conflict · IRP and SERTP disagree on a date</p>
              </div>
              <h3>Opportunities</h3>
              <p>A ranked queue of cross-utility project pairs — by tier, build-window overlap, in-service gap and distance — measured at closest points or Sperry's center method.</p>
            </article>
            <article>
              <div className="lp-mini">
                <p><strong>Jasper – Okatie 230 kV #2: Construct</strong></p>
                <p className="lp-row"><span className="lp-muted">Schedule</span> Dec 31, 2025 → May 31, 2026 <strong>+151 days</strong></p>
                <p className="lp-row"><span className="lp-muted">Cost</span> $23.79M → $28.58M <strong>+20.1%</strong></p>
                <p className="lp-mono lp-muted">desc-2428 p.23 → desc-2529 p.18</p>
              </div>
              <h3>Plan changes</h3>
              <p>{fmt(stats.changes)} detected changes between plan versions — slips, cost moves and renames — with the magnitude computed and both source pages cited.</p>
            </article>
            <article>
              <div className="lp-mini">
                <div className="lp-bar" aria-hidden="true">
                  <span style={{ flexGrow: precision?.sperry_provided ?? 0 }} className="ok" /><span style={{ flexGrow: precision?.osm_feature ?? 0 }} className="ink" />
                  <span style={{ flexGrow: precision?.unresolved ?? 0 }} className="none" />
                </div>
                <p className="lp-row"><span>Sperry-confirmed</span><strong>{count("sperry_provided")}</strong></p>
                <p className="lp-row"><span>OSM-resolved</span><strong>{count("osm_feature")}</strong></p>
                <p className="lp-row"><span className="lp-muted">Unresolved — not guessed</span><strong>{count("unresolved")}</strong></p>
              </div>
              <h3>Data quality</h3>
              <p>Location provenance for every endpoint, a live validation benchmark, and an issue queue of every place the sources disagree.</p>
            </article>
          </div>
        </section>

        <section id="evidence" className="lp-band">
          <div className="lp-wrap lp-split">
            <div>
              <p className="lp-eyebrow">Evidence</p>
              <h2 className="lp-h2">Every number has a page number.</h2>
              <p className="lp-lede">GridPulse keeps three kinds of statement apart, so a planner can tell what a utility published from what we calculated and what we recommend.</p>
            </div>
            <ul className="lp-layers">
              {layers(pair, sourceFact).map((l) => (
                <li key={l.tag}>
                  <span className="lp-layer__tag"><span className={`lp-glyph lp-glyph--${l.glyph}`} aria-hidden="true" />{l.tag}</span>
                  <div><p className="lp-layer__claim">{l.claim}</p><p className="lp-mono lp-muted">{l.src}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="validation" className="lp-wrap lp-section lp-split">
          <div>
            <p className="lp-eyebrow">Validation</p>
            <h2 className="lp-h2">Checked against the answer key. {acceptance && !acceptance.passed ? "Not yet six for six." : "Six for six."}</h2>
            <p className="lp-lede">GridPulse reproduces every overlap in Sperry's answer key to within ±0.01 mi using the center method, matches every in-service gap,
              and leaves the three control projects unflagged.</p>
            <p className="lp-muted">And where the data is thin, it says so. Ambiguous or unmatched endpoints are left unresolved rather than guessed — {quality ? `${quality.coverage.projects_unlocated} of ${quality.coverage.projects}` : PENDING} projects are listed but not mapped.</p>
          </div>
          <table className="lp-table" aria-label="Sperry answer-key benchmark">
            <thead><tr><th scope="col">Case</th><th scope="col" className="num">Answer key</th><th scope="col" className="num">GridPulse</th>
              <th scope="col" className="num">Gap</th><th scope="col" className="num">Result</th></tr></thead>
            <tbody>
              {bench.map((b) => (
                <tr key={b.id}><td className="lp-mono">{b.id}</td><td className="num">{b.expected.toFixed(2)} mi</td>
                  <td className="num">{b.got != null ? `${b.got.toFixed(2)} mi` : "—"}</td><td className="num lp-muted">{b.gap ?? "—"} d</td>
                  <td className={`num ${b.passed ? "" : "lp-fail"}`}>{b.passed ? "Pass" : "Fail"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="lp-cta">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-h2--lg">Start with the pairs that should already be talking.</h2>
            <div className="lp-actions">
              <a className="lp-btn lp-btn--primary" href={WORKSPACE_PATH}>Open the workspace</a>
              <a className="lp-btn lp-btn--ghost" href={REPO_URL} target="_blank" rel="noreferrer">View the source</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__grid">
          <div><p className="lp-brand"><span aria-hidden="true">◆</span> GridPulse</p><p className="lp-muted">Built for Sperry Tech's GridLock challenge.</p></div>
          <div><p className="lp-footer__head">Sources</p><p className="lp-muted">DESC 2024–28 ten-year plan and later editions · Georgia Power 2025 IRP Vol. 3 (public disclosure) · SERTP 2025–26</p></div>
          <div><p className="lp-footer__head">Notes</p><p className="lp-muted">Public, unredacted fields only. Map data © OpenStreetMap contributors (ODbL). AGPL-3.0.</p></div>
        </div>
      </footer>
    </div>
  );
}
