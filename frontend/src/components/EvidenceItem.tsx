import type { EvidenceItemData } from "../types";

export const EVIDENCE_GLYPH: Record<EvidenceItemData["type"], string> = { fact: "■", derived: "□", interpretation: "◆" };

export function EvidenceItem({ item }: { item: EvidenceItemData }) {
  return (
    <li className={`evidence evidence--${item.type}`}>
      <div className="evidence__head">
        <span className="evidence__glyph" aria-label={item.type}>{EVIDENCE_GLYPH[item.type]}</span>
        <span className="evidence__field">{item.field ? item.field.replace(/_/g, " ") : item.label}</span>
        {item.source_id && item.page != null && <span className="mono evidence__ref">{item.source_id} · p.{item.page}</span>}
      </div>
      <p className="evidence__value">{item.quote}</p>
    </li>
  );
}
