import { useState } from "react";
import { computeEstimate, formatUsd, type EstimateValues } from "../format";
import type { EstimatorInputs } from "../types";
import { UtilityChip } from "./UtilityChip";

const FIELDS: { key: keyof EstimateValues; label: string; step: number }[] = [
  { key: "shared_corridor_mi", label: "Shared corridor (mi)", step: 0.1 },
  { key: "row_width_ft", label: "ROW width (ft)", step: 5 },
  { key: "usd_per_acre", label: "Land $/acre", step: 500 },
  { key: "mobilization_usd", label: "$ per mobilization", step: 10000 },
  { key: "avoided_mobilizations", label: "Avoided mobilizations", step: 1 },
];

export type EstimatorDraft = Record<keyof EstimateValues, string>;

export function initialDraft(inputs: EstimatorInputs): EstimatorDraft {
  return Object.fromEntries(FIELDS.map((f) => [f.key, String(inputs[f.key])])) as EstimatorDraft;
}

export function draftNumbers(draft: EstimatorDraft): EstimateValues {
  return Object.fromEntries(FIELDS.map((f) => [f.key, Math.max(0, Number(draft[f.key]) || 0)])) as unknown as EstimateValues;
}

interface Props {
  inputs: EstimatorInputs;
  /** Controlled mode (the detail panel shares edits with the brief export). Omit for self-contained use. */
  draft?: EstimatorDraft;
  onDraft?: (next: EstimatorDraft) => void;
}

/** Mount with a `key` per opportunity so edits never leak between pairs. */
export function CostEstimator({ inputs, draft, onDraft }: Props) {
  const [local, setLocal] = useState(() => initialDraft(inputs));
  const values = draft ?? local;
  const setValues = (update: (v: EstimatorDraft) => EstimatorDraft) => (onDraft ? onDraft(update(values)) : setLocal(update));

  const result = computeEstimate(draftNumbers(values));

  return (
    <section className="estimator" aria-label="Cost and impact estimate">
      <header className="section-head"><span className="tag">COST / IMPACT</span><span className="tag tag--warn">ROUGH ESTIMATE</span></header>
      {inputs.corridor_source && <p className="small muted">Corridor default: {inputs.corridor_source}.</p>}
      <p className="mono formula">acres = mi × 5,280 × ROW ft ÷ 43,560 · value = acres × $/acre + $/mobilization × avoided</p>
      <div className="estimator__grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="field__label">{f.label}</span>
            <input className="input mono" type="number" min={0} step={f.step} value={values[f.key]}
                   onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <dl className="estimator__out mono">
        <div><dt>Shared ROW</dt><dd>{result.acres.toFixed(1)} acres</dd></div>
        <div><dt>Land value</dt><dd>{formatUsd(result.land)}</dd></div>
        <div><dt>Mobilization saved</dt><dd>{formatUsd(result.mobilization)}</dd></div>
        <div className="estimator__total"><dt>Illustrative value</dt><dd data-testid="estimate-total">{formatUsd(result.total)}</dd></div>
      </dl>
      <ul className="cost-context">
        {inputs.cost_context.map((c) => (
          <li key={c.utility}><UtilityChip utility={c.utility} />{" "}
            {c.total_usd != null
              ? <><span className="tag">FACT</span> public project cost <span className="mono">{formatUsd(c.total_usd)}</span></>
              : <span className="muted">cost {c.note ?? "not published"}</span>}
          </li>
        ))}
      </ul>
      <details className="assumptions"><summary>Assumptions</summary>
        <ul>{inputs.assumptions.map((a) => <li key={a.key}>{a.text}</li>)}</ul>
      </details>
    </section>
  );
}
