import { summarize, type Filters } from "../filters";
import type { Method, Opportunity } from "../types";
import { MAX_RADIUS, MIN_RADIUS } from "../urlState";
import { radioProps } from "../useRovingRadio";
import { Popover } from "./Popover";

const METHODS: readonly Method[] = ["closest", "center"];
const RADIUS_PRESETS = [1, 5, 10, 25, 50];
const METHOD_TEXT: Record<Method, string> = { closest: "Closest points", center: "Project centers" };
const METHOD_HELP = "Closest points: shortest distance between the two projects' geometry (the spec's primary rule). "
  + "Project centers: Sperry's answer-key method, center-to-center haversine.";

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

/** Study title, metric strip (each metric filters the queue) and one Distance control (method + radius). */
export function StudyBar({ items, filters, method, onMethod, distance, onDistance, onReset, onMustCoordinate, onOverlap, onConflicts }: Props) {
  const s = summarize(items);
  const t1Only = filters.tiers.length === 1 && filters.tiers[0] === "T1";
  const metrics = [
    { key: "all", value: s.pairs, label: "candidates", active: false, onClick: onReset, hint: "Show every DESC × GPC pair" },
    { key: "t1", value: s.mustCoordinate, label: "must coordinate", active: t1Only, onClick: onMustCoordinate, hint: "T1: touching or a shared facility" },
    { key: "overlap", value: s.sameWindow, label: "overlap", active: filters.sameWindowOnly, onClick: onOverlap,
      hint: "Build windows overlap (GPC: published start → need; DESC: estimated from spend years)" },
    { key: "conflicts", value: s.sourcesDisagree, label: "conflicts", active: filters.flags.includes("sources_disagree"),
      onClick: onConflicts, hint: "Source documents disagree on a date", warn: true },
  ];
  return (
    <section className="studybar" aria-label="Study summary and distance settings">
      <h1 className="page-title" title="Cross-utility project pairs · ranked by tier, timing, gap, distance">Savannah / Augusta study</h1>
      <div className="metrics">
        {metrics.map((m) => (
          <button key={m.key} type="button" className={`metric ${m.active ? "is-active" : ""} ${m.warn ? "metric--warn" : ""}`}
                  aria-pressed={m.active} onClick={m.onClick} title={m.hint}>
            <span className="metric__value">{m.value}</span> <span className="metric__label">{m.label}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <Popover label={<><span className="muted">Distance</span> <strong>{METHOD_TEXT[method]}</strong> <span className="muted">·</span> <strong>{distance} mi</strong></>}
               ariaLabel={`Distance: ${METHOD_TEXT[method].toLowerCase()}, ${distance} miles`} align="right" className="distance-popover">
        {() => (
          <div className="radius">
            <p className="menu__label" title={METHOD_HELP}>Distance calculated by</p>
            <div className="segmented segmented--block" role="radiogroup" aria-label="Distance method" title={`${METHOD_HELP} (M switches)`}>
              {METHODS.map((m) => <button key={m} type="button" className="segmented__item" {...radioProps(METHODS, method, onMethod, m)}>{METHOD_TEXT[m]}</button>)}
            </div>
            <p className="menu__label"><strong>Radius</strong> — include pairs whose {method === "closest" ? "closest points" : "centers"} are within</p>
            <div className="radius__presets">
              {RADIUS_PRESETS.map((r) => (
                <button key={r} type="button" className="chip-btn" aria-pressed={distance === r} onClick={() => onDistance(r)}>{r} mi</button>
              ))}
            </div>
            <input type="range" min={MIN_RADIUS} max={MAX_RADIUS} step={1} value={distance} aria-label="Radius in miles" aria-valuetext={`${distance} miles`}
                   onChange={(e) => onDistance(Number(e.target.value))} style={{ ["--fill" as string]: `${((distance - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100}%` }} />
            <p className="small muted">Tiers stay fixed: T1 touching · T2 &lt; 1 mi · T3 &lt; 5 mi · T4 ≤ 25 mi.</p>
          </div>
        )}
      </Popover>
    </section>
  );
}
