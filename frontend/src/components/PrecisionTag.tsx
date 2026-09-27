import { PRECISION_TEXT } from "../format";
import type { Precision } from "../types";

const HELP: Record<Precision, string> = {
  osm_feature: "Matched by name to an OpenStreetMap substation",
  sperry_provided: "Coordinates from Sperry's answer key",
  endpoint_proxy: "Inferred from connected line endpoints",
  regional_approximation: "Town-level approximation",
  unresolved: "Not located",
};

export function PrecisionTag({ precision }: { precision: Precision }) {
  return <span className={`tag precision precision--${precision}`} title={HELP[precision]}>{PRECISION_TEXT[precision]}</span>;
}
