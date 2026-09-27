// Plan-change deltas, computed client-side only when both values parse (handoff step 7).
export interface Delta {
  main: string;
  sub: string;
  tone: "neutral" | "warn" | "ok";
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\$[\d,]+$/;
const DAYS_PER_MONTH = 30.4375;
const LATE_DAYS = 365;
const COST_WARN_RATIO = 0.5;
const MINUS = "−";

const signed = (n: number, text: string) => `${n < 0 ? MINUS : "+"}${text}`;

function dateDelta(before: string, after: string): Delta {
  const days = Math.round((Date.parse(after) - Date.parse(before)) / 86_400_000);
  const months = (Math.abs(days) / DAYS_PER_MONTH).toFixed(1);
  return {
    main: `${signed(days, String(Math.abs(days)))} days`,
    sub: `≈ ${months} mo ${days >= 0 ? "later" : "earlier"}`,
    tone: days < 0 ? "ok" : days > LATE_DAYS ? "warn" : "neutral",
  };
}

function costDelta(before: number, after: number): Delta {
  const diff = after - before;
  const ratio = diff / before;
  return {
    main: signed(diff, `$${(Math.abs(diff) / 1e6).toFixed(2)}M`),
    sub: signed(ratio, `${Math.abs(ratio * 100).toFixed(1)}%`),
    tone: diff < 0 ? "ok" : ratio > COST_WARN_RATIO ? "warn" : "neutral",
  };
}

export function changeDelta(before: string | null, after: string | null): Delta | null {
  if (!before || !after) return null;
  if (ISO.test(before) && ISO.test(after)) return dateDelta(before, after);
  if (MONEY.test(before) && MONEY.test(after)) {
    const toNumber = (s: string) => Number(s.replace(/[$,]/g, ""));
    const b = toNumber(before);
    return b > 0 ? costDelta(b, toNumber(after)) : null;
  }
  return null;
}
