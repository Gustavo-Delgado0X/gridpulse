import type { EvidenceItemData } from "../types";

export function EvidenceItem({ item }: { item: EvidenceItemData }) {
  const tagClass = item.type === "interpretation" ? "tag tag--muted" : "tag";
  return (
    <li className={`evidence evidence--${item.type}`}>
      <span className={tagClass}>{item.label}</span>
      {item.field && <span className="evidence__field">{item.field.replace(/_/g, " ")}</span>}
      <blockquote className="evidence__quote">{item.quote}</blockquote>
      {item.source_id && item.page != null && <span className="mono evidence__ref">{item.source_id} · P.{item.page}</span>}
    </li>
  );
}
