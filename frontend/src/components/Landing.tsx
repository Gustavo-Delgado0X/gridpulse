import { useState } from "react";
import { TIER_TEXT } from "../format";
import { discrepancyCards, formatDay } from "../landingData";
import { WORKSPACE_PATH } from "../route";
import type { Opportunity, Quality } from "../types";
import { toHash } from "../urlState";
import { TIER_RANGE } from "./OpportunityTable";

export interface LandingStats {
  projects: number | null;
  pairs: number | null;
  changes: number | null;
  acceptance: Quality["acceptance"] | null;
  independent: Quality["independent"] | null;
}

export interface SourceFact {
  name: string;
  printed: string;
  source_id: string;
  page: number;
}

interface Props {
  stats: LandingStats;
  /** The pair used for the Evidence section and the product screenshot. */
  featured?: Opportunity | null;
  /** The top-ranked pair, shown in the hero. */
  finding?: Opportunity | null;
  /** Where the top-ranked pair touches, when it does. */
  shared?: { name: string; lat: number; lon: number } | null;
  quality?: Quality | null;
  /** The featured DESC project's in-service date exactly as printed in the list GridPulse ranks on. */
  sourceFact?: SourceFact | null;
}

const PENDING = "—";
const REPO_URL = "https://github.com/Gustavo-Delgado0X/gridpulse";
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const month = (iso: string) => MONTH.format(new Date(`${iso}T00:00:00Z`));
const fmt = (n: number | null | undefined) => (n == null ? PENDING : String(n));
const miles = (o: Opportunity) => (o.touching ? "0.00 mi" : `${o.dist_closest_mi.toFixed(2)} mi`);
const sentence = (s: string) => s[0] + s.slice(1).toLowerCase();
const pairHref = (o: Opportunity | null | undefined) => (o ? `${WORKSPACE_PATH}${toHash({ pair: o.id, method: "closest", d: 25 })}` : WORKSPACE_PATH);

/** The build-window intersection of the featured pair, e.g. "Jun 2025 → Dec 2025". */
export function overlapRange(o: Opportunity | null | undefined): string | null {
  const [a, b] = o ? [o.a, o.b] : [];
  if (!a?.window_start || !a.window_end || !b?.window_start || !b.window_end || !o?.window_overlap_days) return null;
  const start = a.window_start > b.window_start ? a.window_start : b.window_start;
  const end = a.window_end < b.window_end ? a.window_end : b.window_end;
  return `${month(start)} → ${month(end)}`;
}

type ShotKey = "opportunities" | "changes" | "quality";

function shots(stats: LandingStats, featured: Opportunity | null | undefined) {
  return {
    opportunities: { label: "Opportunities", path: `opportunities/${featured ? String(featured.rank).padStart(2, "0") : ""}`,
      src: "/landing/opportunities.jpg", alt: "Opportunities: a ranked pair's detail beside the map",
      head: "A ranked queue of every DESC × Georgia Power pair, with the map beside it.",
      body: `${fmt(stats.pairs)} pairs within 25 mi, tiered from touching to under 25 mi, measured at closest points or with Sperry's center method, and weighed by build-window overlap. Open any pair to see why it ranks where it does.` },
    changes: { label: "Plan changes", path: "plan-changes", src: "/landing/plan-changes.jpg", alt: "Plan changes: schedule slips and cost changes grouped by project",
      head: `${fmt(stats.changes)} changes between plan editions, with the size of each one.`,
      body: "Slipped in-service dates, cost moves and renamed projects, grouped by project. Both source pages are cited, and each change links to the opportunities it affects." },
    quality: { label: "Data quality", path: "data-quality", src: "/landing/data-quality.jpg", alt: "Data quality: location provenance, answer-key benchmark and issue queue",
      head: "Where each coordinate came from, and where the sources disagree.",
      body: "Every endpoint is resolved from OpenStreetMap or left unresolved; none is taken from the answer key. A benchmark checks GridPulse against Sperry's answer key, and an issue queue lists every conflict." },
  } satisfies Record<ShotKey, Record<string, string>>;
}

function Finding({ finding, shared }: Pick<Props, "finding" | "shared">) {
  return (
    <figure className="lp2-finding" aria-label="Top-ranked finding">
      <div className="lp2-finding__head"><span>FINDING · RANK #{finding ? String(finding.rank).padStart(2, "0") : PENDING}</span>
        <span>{finding?.tier ?? PENDING} · {finding ? (finding.touching ? "TOUCHING" : TIER_RANGE[finding.tier!]) : PENDING}</span></div>
      <div className="lp2-finding__row">
        <span className="lp2-mono lp2-dim">Center to center · Sperry's method</span>
        <span className="lp2-finding__center">{finding ? `${finding.dist_center_mi.toFixed(2)} mi` : PENDING}</span>
      </div>
      <div className="lp2-finding__row">
        <span className="lp2-mono">Closest points · GridPulse</span>
        <span className="lp2-finding__closest">{finding ? miles(finding) : PENDING}</span>
      </div>
      <div className="lp2-finding__foot">
        <span className="lp2-proj"><span className="lp2-dot" aria-hidden="true" />{finding?.a.name ?? PENDING}<span className="lp2-dim">DESC</span></span>
        <span className="lp2-proj"><span className="lp2-sq" aria-hidden="true" />{finding?.b.name ?? PENDING}<span className="lp2-dim">GPC</span></span>
        <span className="lp2-dim small">{shared
          ? `They share the ${shared.name} endpoint at ${shared.lat.toFixed(4)}, ${shared.lon.toFixed(4)}. Same substation, different plans.`
          : finding ? `Closest points ${miles(finding)} apart.` : PENDING}</span>
        {finding && <a className="lp2-link" href={pairHref(finding)}>Open this pair →</a>}
      </div>
    </figure>
  );
}

function Product({ stats, featured }: Pick<Props, "stats" | "featured">) {
  const [view, setView] = useState<ShotKey>("opportunities");
  const all = shots(stats, featured);
  const shot = all[view];
  return (
    <section id="product" className="lp2-product" aria-label="Product">
      <div role="tablist" aria-label="Product views" className="lp2-tabs">
        {(Object.keys(all) as ShotKey[]).map((key, i) => (
          <button key={key} type="button" role="tab" id={`shot-${key}`} aria-selected={view === key} aria-controls="shot-panel"
                  className="lp2-tab" onClick={() => setView(key)}><span className="lp2-mono">0{i + 1}</span>{all[key].label}</button>
        ))}
      </div>
      <div id="shot-panel" role="tabpanel" aria-labelledby={`shot-${view}`} className="lp2-window">
        <div className="lp2-window__bar"><span /><span /><span /><span className="lp2-mono">gridpulse / savannah-augusta / {shot.path}</span></div>
        <img src={shot.src} alt={shot.alt} width={1600} height={940} />
      </div>
      <div className="lp2-caption"><p className="lp2-caption__head">{shot.head}</p><p>{shot.body}</p></div>
    </section>
  );
}

function layers(pair: Opportunity | null, fact: SourceFact | null | undefined) {
  const overlap = pair?.window_overlap_days ? `their build windows overlap by ${pair.window_overlap_days} days${overlapRange(pair) ? ` (${overlapRange(pair)})` : ""}` : "their build windows do not overlap";
  return [
    { tag: "SOURCE FACT", kind: "fact", claim: fact ? `${fact.name} is planned to enter service ${fact.printed}.` : PENDING,
      src: fact ? `${fact.source_id} · p.${fact.page} · quoted as printed` : "loading" },
    { tag: "DERIVED", kind: "derived",
      claim: pair ? `Its closest point is ${miles(pair)} from ${pair.b.name}, and ${overlap}.` : PENDING,
      src: "Computed by GridPulse · closest-point geometry" },
    { tag: "ASSESSMENT", kind: "assessment",
      claim: pair?.tier ? `Tier ${pair.tier}: ${sentence(TIER_TEXT[pair.tier])}. A candidate for human review.` : PENDING,
      src: "GridPulse rationale · labelled as such" },
  ];
}

export function Landing({ stats, featured, finding, shared, quality, sourceFact }: Props) {
  const { acceptance, independent } = stats;
  const coverage = quality?.coverage;
  const unresolved = coverage ? coverage.endpoints_by_precision.unresolved ?? 0 : null;
  const cards = discrepancyCards(quality?.discrepancies ?? []);
  const conflict = quality?.discrepancies.filter((d) => d.kind === "coordinate_conflict").toSorted((a, b) => (b.miles_apart ?? 0) - (a.miles_apart ?? 0))[0];
  const proof = [
    { n: fmt(stats.projects), l: "projects parsed from public plans" },
    { n: fmt(stats.pairs), l: "DESC × GPC pairs within 25 mi" },
    { n: fmt(stats.changes), l: "changes detected between plan editions" },
    { n: fmt(unresolved), l: "endpoints left unresolved, not guessed" },
  ];
  const problems = [
    { n: "A", h: "Plans are PDFs, not data", b: "Hundreds of pages of tables and detail sheets, a different format for each utility, and some fields redacted." },
    { n: "B", h: "Neighbours plan separately", b: "DESC and Georgia Power schedule work a few miles apart across the river, with overlapping build windows." },
    { n: "C", h: "Schedules drift", b: "Dates slip and costs move between editions, and the tables often disagree with their own detail pages." },
    { n: "D", h: "Places are named, not located", b: conflict
      ? `The ${conflict.endpoint} substation appears at two coordinates ${(conflict.miles_apart ?? 0).toFixed(2)} mi apart: one from OpenStreetMap, one from Sperry's answer key.`
      : "Substations are named in the plans, not placed on a map." },
  ];

  return (
    <div className="landing lp2">
      <a className="skip-link" href="#main">Skip to content</a>
      <section id="top" className="lp2-hero">
        <div className="lp2-grid" aria-hidden="true" />
        <header className="lp2-wrap lp2-nav">
          <a className="lp2-brand" href="/"><span className="lp2-diamond" aria-hidden="true" />GridPulse</a>
          <nav aria-label="Sections" className="lp2-nav__links">
            <a href="#corridor">The corridor</a><a href="#product">Product</a><a href="#evidence">Evidence</a><a href="#validation">Validation</a>
          </nav>
          <a className="lp2-btn lp2-btn--light lp2-btn--sm" href={WORKSPACE_PATH}>Open the study <span aria-hidden="true">→</span></a>
        </header>
        <div id="main" className="lp2-wrap lp2-hero__body">
          <div className="lp2-hero__copy">
            <span className="lp2-eyebrow"><span className="lp2-live" aria-hidden="true" />SAVANNAH / AUGUSTA STUDY · DESC × GEORGIA POWER</span>
            <h1 className="lp2-h1">Where two utilities' plans <em>meet</em>.</h1>
            <p className="lp2-lede">GridPulse reads both utilities' transmission plans, ranks the project pairs that should be coordinating, and cites
              the page behind every distance, date and dollar.</p>
            <div className="lp2-actions">
              <a className="lp2-btn lp2-btn--light" href={WORKSPACE_PATH}>Explore the {fmt(stats.projects)} projects <span aria-hidden="true">→</span></a>
              <a className="lp2-btn lp2-btn--outline-light" href="#evidence">How we cite</a>
            </div>
          </div>
          <Finding finding={finding} shared={shared} />
        </div>
      </section>

      <Product stats={stats} featured={featured} />

      <section className="lp2-wrap lp2-proof" aria-label="At a glance">
        {proof.map((p) => <div key={p.l}><p className="lp2-proof__n">{p.n}</p><p className="lp2-proof__l">{p.l}</p></div>)}
      </section>

      <section id="corridor" className="lp2-wrap lp2-section lp2-split">
        <div className="lp2-stack"><span className="lp2-kicker">01 — THE CORRIDOR</span>
          <h2 className="lp2-h2">The Savannah River is a state line. It isn't a construction line.</h2></div>
        <div>
          {problems.map((p) => (
            <div key={p.n} className="lp2-problem"><span className="lp2-mono lp2-muted">{p.n}</span>
              <div><h3>{p.h}</h3><p>{p.b}</p></div></div>
          ))}
        </div>
      </section>

      <section className="lp2-band" aria-label="Discrepancies">
        <div className="lp2-wrap lp2-band__inner">
          <div className="lp2-band__head">
            <h2 className="lp2-h3">{quality ? `${quality.discrepancies.length} places the sources disagree.` : "Where the sources disagree."} Logged, not smoothed over.</h2>
            <span className="lp2-mono lp2-muted">quality.json{quality?.built_at ? ` · built ${formatDay(quality.built_at.slice(0, 10))}` : ""}</span>
          </div>
          <div className="lp2-cards">
            {cards.map((c) => (
              <div key={`${c.kind}-${c.id}`} className="lp2-card">
                <span className="lp2-card__meta"><span>{c.kind}</span><span>{c.id}</span></span>
                <span className="lp2-card__name">{c.name}</span>
                <span className="lp2-card__vs"><s>{c.a}</s><span aria-hidden="true">vs</span><span className="sr-only">versus</span><span>{c.b}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="evidence" className="lp2-wrap lp2-section lp2-stack--lg">
        <div className="lp2-split lp2-split--end">
          <div className="lp2-stack"><span className="lp2-kicker">02 — EVIDENCE</span><h2 className="lp2-h2">Every number has a page number.</h2></div>
          <p className="lp2-body">GridPulse keeps three kinds of statement apart, so a planner can see what a utility published, what we calculated, and what we recommend.</p>
        </div>
        <div className="lp2-layers">
          {layers(featured ?? null, sourceFact).map((l, i) => (
            <div key={l.tag} className={`lp2-layer lp2-layer--${l.kind}`}>
              <div className="lp2-layer__head"><span className="lp2-layer__tag"><span className="lp2-layer__mark" aria-hidden="true" />{l.tag}</span>
                <span className="lp2-mono lp2-faint">{i + 1}/3</span></div>
              <div className="lp2-layer__body"><p className="lp2-layer__claim">{l.claim}</p><p className="lp2-mono lp2-layer__src">{l.src}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="validation" className="lp2-dark">
        <div className="lp2-wrap lp2-section lp2-split">
          <div className="lp2-stack">
            <span className="lp2-kicker lp2-kicker--dark">03 — VALIDATION</span>
            <span className="lp2-huge">{independent ? `${independent.found}/${independent.expected}` : PENDING}</span>
            <h2 className="lp2-h3">Every pair in Sperry's answer key, found with GridPulse's own OpenStreetMap locations.</h2>
            <p className="lp2-dim">The answer key is a benchmark, never a data source.{acceptance
              ? ` Run on the key's own coordinates, the distance math reproduces ${acceptance.matched} of ${acceptance.expected} distances to ±0.01 mi, with exact day gaps.` : ""}</p>
            <p className="lp2-dim">Where the data is thin, GridPulse says so. {fmt(unresolved)} endpoints stay unresolved rather than guessed, and
              {" "}{coverage ? `${coverage.projects_unlocated} of ${coverage.projects}` : PENDING} projects are listed without being mapped. Okatie is not in
              OpenStreetMap, so centers that depend on it differ from the key.</p>
          </div>
          <table className="lp2-table" aria-label="Answer-key pairs found with GridPulse locations">
            <thead><tr><th scope="col">CASE</th><th scope="col" className="num">KEY</th><th scope="col" className="num">GRIDPULSE</th>
              <th scope="col" className="num">TIER</th><th scope="col" className="num">GAP</th><th scope="col"><span className="sr-only">Result</span></th></tr></thead>
            <tbody>
              {(independent?.details ?? []).map((d) => (
                <tr key={d.overlap_id}><td className="lp2-mono">{d.overlap_id}</td><td className="num lp2-dim">{d.expected_mi.toFixed(2)}</td>
                  <td className="num">{d.got_center_mi != null ? d.got_center_mi.toFixed(2) : PENDING}</td><td className="num">{d.tier ?? PENDING}</td>
                  <td className="num lp2-dim">{d.got_gap ?? PENDING} d</td>
                  <td className={`num ${d.found ? "lp2-ok" : "lp2-fail"}`}>{d.found ? "✓ Found" : "✗ Not found"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lp2-wrap lp2-cta">
        <h2 className="lp2-h1 lp2-h1--ink">Start with the pairs that should already be talking.</h2>
        <div className="lp2-actions">
          <a className="lp2-btn lp2-btn--ink" href={WORKSPACE_PATH}>Open the study <span aria-hidden="true">→</span></a>
          <a className="lp2-btn lp2-btn--outline" href={REPO_URL} target="_blank" rel="noreferrer">Read the source</a>
        </div>
      </section>

      <footer className="lp2-footer">
        <div className="lp2-wrap lp2-footer__grid">
          <div><p className="lp2-brand lp2-brand--ink"><span className="lp2-diamond" aria-hidden="true" />GridPulse</p><p>Built for Sperry Tech's GridLock challenge.</p></div>
          <div><p className="lp2-footer__head">Sources</p><p>DESC planned transmission projects $2M and above (2024–28, 2025–29, 2026–30) · Georgia Power 2025 IRP Vol. 3
            (public disclosure) · SERTP 2025–26</p></div>
          <div><p className="lp2-footer__head">Notes</p><p>Public, unredacted fields only. Map data © OpenStreetMap contributors (ODbL). AGPL-3.0.</p></div>
        </div>
      </footer>
    </div>
  );
}
