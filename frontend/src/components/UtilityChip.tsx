import type { Utility } from "../types";

const SHAPE: Record<Utility, "circle" | "square" | "diamond"> = { DESC: "circle", GPC: "square", other_utility: "diamond" };
const LABEL: Record<Utility, string> = { DESC: "DESC", GPC: "GPC", other_utility: "OTHER" };

export function UtilityChip({ utility }: { utility: Utility }) {
  return (
    <span className={`chip chip--${utility}`}>
      <span className={`shape shape--${SHAPE[utility]}`} data-shape={SHAPE[utility]} aria-hidden="true" />
      {LABEL[utility]}
    </span>
  );
}
