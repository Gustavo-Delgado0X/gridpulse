import { summarize, type Filters } from "../filters";
import type { Method, Opportunity } from "../types";
import { radioProps } from "../useRovingRadio";
import { Popover } from "./Popover";

const METHODS: readonly Method[] = ["closest", "center"];
const RADIUS_PRESETS = [5, 10, 15, 25, 50];
const METHOD_HELP = "Closest points: shortest distance between the two projects' geometry (the spec's primary rule). " +
  "Project centers: Sperry's answer-key method, center-to-center haversine.";

interface Props {
  items: Opportunity[];
  filters: Filters;
  method: Method;
  onMethod: (m: Method) => void;
  distance: number;
  onDistance: (d: number) => void;
  onReset: () => void;
  onMustCoordinate: () => void;
  onOverlap: () => void;
  onConflicts: () => void;
}

/** Study title, metric strip (each metric filters the queue), distance method and radius. */
export function OpportunitiesToolbar({ items, filters, method, onMethod, distance, onDistance, onReset, onMustCoordinate, onOverlap, onConflicts }: Props) {
  const s = summarize(items);
  const t1Only = filters.tiers.length === 1 && filters.tiers[0] === "T1";
  const metrics = [
    { key: "all", value: s.pairs, label: "candidates", active: false, onClick: onReset, hint: "Show every DESC × GPC pair" },
    { key: "t1", value: s.mustCoordinate, label: "must coordinate", active: t1Only, onClick: onMustCoordinate,
      hint: "T1: touching or a shared facility" },
    { key: "overlap", value: s.sameWindow, label: "overlap", active: filters.sameWindowOnly, onClick: onOverlap,
      hint: "Published build windows overlap" },
    { key: "conflicts", value: s.sourcesDisagree, label: "conflicts", active: filters.flags.includes("sources_disagree"),
      onClick: onConflicts, hint: "Source documents disagree on a date", warn: true },
  ];
  return (
    <section className="toolbar opp-toolbar" aria-label="Study summary and distance settings">
      <h1 className="page-title" title="Where Dominion Energy SC and Georgia Power plan work close together, ranked, sourced and checked against Sperry's answer key.">
        Savannah / Augusta study
      </h1>
      <div className="metrics">
        {metrics.map((m) => (
          <button key={m.key} type="button" className={`metric ${m.active ? "is-active" : ""} ${m.warn ? "metric--warn" : ""}`}
                  aria-pressed={m.active} onClick={m.onClick} title={m.hint}>
            <span className="metric__value">{m.value}</span> <span className="metric__label">{m.label}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <span className="toolbar__label" title={METHOD_HELP}>Distance by</span>
      <div className="segmented" role="radiogroup" aria-label="Distance method" title={`${METHOD_HELP} (M switches)`}>
        <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "closest")}>Closest points</button>
        <button type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, "center")}>Project centers</button>
      </div>
      <Popover label={<>Radius <strong>{distance} mi</strong></>} ariaLabel={`Radius ${distance} miles`} align="right">
        {() => (
          <div className="radius">
            <p className="menu__label">Show pairs within</p>
            <div className="radius__presets">
              {RADIUS_PRESETS.map((r) => (
                <button key={r} type="button" className="chip-btn" aria-pressed={distance === r} onClick={() => onDistance(r)}>{r} mi</button>
              ))}
            </div>
            <input type="range" min={5} max={50} step={1} value={distance} aria-label="Radius in miles" aria-valuetext={`${distance} miles`}
                   onChange={(e) => onDistance(Number(e.target.value))} style={{ ["--fill" as string]: `${((distance - 5) / 45) * 100}%` }} />
            <p className="small muted">Tiers stay fixed: T1 touching · T2 &lt; 1 mi · T3 &lt; 5 mi · T4 ≤ 25 mi.</p>
          </div>
        )}
      </Popover>
    </section>
  );
}
