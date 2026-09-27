import { TIER_TEXT } from "../format";
import type { Tier } from "../types";

export function TierBadge({ tier, compact = false }: { tier: Tier | null; compact?: boolean }) {
  if (!tier) return <span className="tier-badge tier-badge--none" title="Beyond the 25 mi tier table">{compact ? "—" : "Beyond 25 mi"}</span>;
  const full = `${tier} · ${TIER_TEXT[tier]}`;
  return <span className={`tier-badge tier-badge--${tier}`} title={full} aria-label={full}>{compact ? tier : full}</span>;
}
