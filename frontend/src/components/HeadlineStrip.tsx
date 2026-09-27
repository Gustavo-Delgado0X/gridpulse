import { summarize, type Filters } from "../filters";
import type { Opportunity, Quality, Tier } from "../types";

interface Props {
  items: Opportunity[];
  distance: number;
  filters: Filters;
  acceptance: Quality["acceptance"] | null;
  onReset: () => void;
  onTier: (tier: Tier) => void;
  onSameWindow: () => void;
  onFlag: (flag: string) => void;
  onQuality: () => void;
}

/** The answer in one row: every number is also a filter (or a jump to the proof). */
export function HeadlineStrip({ items, distance, filters, acceptance, onReset, onTier, onSameWindow, onFlag, onQuality }: Props) {
  const s = summarize(items);
  const kpis = [
    { key: "pairs", value: s.pairs, label: `PAIRS WITHIN ${distance} MI`, active: false, onClick: onReset,
      hint: "Show every DESC × GPC pair" },
    { key: "t1", value: s.mustCoordinate, label: "MUST COORDINATE", active: filters.tiers.length === 1 && filters.tiers[0] === "T1",
      onClick: () => onTier("T1"), hint: "Filter to T1: touching or shared facility" },
    { key: "window", value: s.sameWindow, label: "SAME BUILD WINDOW", active: filters.sameWindowOnly, onClick: onSameWindow,
      hint: "Filter to pairs whose published build windows overlap" },
    { key: "disagree", value: s.sourcesDisagree, label: "SOURCES DISAGREE", active: filters.flag === "sources_disagree",
      onClick: () => onFlag("sources_disagree"), hint: "Filter to pairs where the IRP, SERTP or tables conflict" },
  ];
  return (
    <section className="headline" aria-label="Summary">
      <p className="headline__lede">
        Where Dominion Energy SC and Georgia Power plan work close together — ranked, sourced, and checked against Sperry’s answer key.
      </p>
      <div className="headline__kpis">
        {kpis.map((k) => (
          <button key={k.key} type="button" className={`kpi ${k.active ? "is-active" : ""}`} aria-pressed={k.active}
                  onClick={k.onClick} title={k.hint}>
            <span className="kpi__value mono">{k.value}</span>
            <span className="kpi__label">{k.label}</span>
          </button>
        ))}
        {acceptance && (
          <button type="button" className={`kpi kpi--proof ${acceptance.passed ? "" : "kpi--fail"}`} onClick={onQuality}
                  title="Open the data-quality view: Sperry's six overlaps reproduced to ±0.01 mi">
            <span className="kpi__value mono">{acceptance.passed ? "✓" : "✗"}</span>
            <span className="kpi__label">{`ANSWER KEY ${acceptance.matched}/${acceptance.expected}`}</span>
          </button>
        )}
      </div>
    </section>
  );
}
