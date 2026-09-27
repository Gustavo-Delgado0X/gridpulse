import type { Triage } from "../types";
import { radioProps } from "../useRovingRadio";

const OPTIONS: readonly Triage[] = ["new", "reviewed", "contacted", "dismissed"];

export function TriageControl({ value, onChange }: { value: Triage; onChange: (next: Triage) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Triage status">
      {OPTIONS.map((option) => (
        <button key={option} type="button" className="segmented__item" {...radioProps(OPTIONS, value, onChange, option)}>
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
