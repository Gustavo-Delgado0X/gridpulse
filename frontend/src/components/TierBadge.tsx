import { TIER_TEXT } from "../format";
import type { Tier } from "../types";

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return <span className="tag tag--muted">BEYOND 25 MI</span>;
  return <span className={`tag tier tier--${tier}`}>{`${tier} · ${TIER_TEXT[tier]}`}</span>;
}
