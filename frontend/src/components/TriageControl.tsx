import type { Triage } from "../types";
import { radioProps } from "../useRovingRadio";
import { Popover } from "./Popover";

const OPTIONS: readonly Triage[] = ["new", "reviewed", "contacted", "dismissed"];
const title = (t: Triage) => t[0].toUpperCase() + t.slice(1);

/** Review status as a compact menu (same four states, stored per browser). */
export function TriageControl({ value, onChange }: { value: Triage; onChange: (next: Triage) => void }) {
  return (
    <Popover label={<><span className={`dot dot--${value}`} aria-hidden="true" /> {title(value)}</>} ariaLabel={`Review status: ${title(value)}`}
             align="right" className="triage-menu">
      {(close) => (
        <div className="menu" role="radiogroup" aria-label="Triage status">
          {OPTIONS.map((option) => {
            const props = radioProps(OPTIONS, value, (t) => { onChange(t); }, option);
            return (
              <button key={option} type="button" className="menu__item" {...props} onClick={() => { onChange(option); close(); }}>
                <span className={`dot dot--${option}`} aria-hidden="true" /> {title(option)}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
