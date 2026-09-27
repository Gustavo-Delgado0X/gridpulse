import { TIER_TEXT } from "../format";
import type { Tier } from "../types";

export function TierBadge({ tier, compact = false }: { tier: Tier | null; compact?: boolean }) {
  if (!tier) return <span className="tag tag--muted" title="Beyond the 25 mi tier table">{compact ? "—" : "BEYOND 25 MI"}</span>;
  const full = `${tier} · ${TIER_TEXT[tier]}`;
  return <span className={`tag tier tier--${tier}`} title={full} aria-label={full}>{compact ? tier : full}</span>;
}
