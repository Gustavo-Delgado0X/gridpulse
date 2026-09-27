import type { Triage } from "../types";

const OPTIONS: Triage[] = ["new", "reviewed", "contacted", "dismissed"];

export function TriageControl({ value, onChange }: { value: Triage; onChange: (next: Triage) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Triage status">
      {OPTIONS.map((option) => (
        <button key={option} type="button" role="radio" aria-checked={value === option}
                className="segmented__item" onClick={() => onChange(option)}>
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
