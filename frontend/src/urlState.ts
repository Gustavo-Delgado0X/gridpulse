// Shareable deep links: #pair=<id>&m=closest|center&d=<1..50> (matches the API bounds)
import type { Method } from "./types";

export interface UrlState {
  pair?: string;
  method?: Method;
  d?: number;
}

export const MIN_RADIUS = 1;
export const MAX_RADIUS = 50;
const PAIR = /^[a-z0-9-]+__[a-z0-9-]+$/;

export function parseHash(hash: string): UrlState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const state: UrlState = {};
  const pair = params.get("pair");
  if (pair && PAIR.test(pair)) state.pair = pair;
  const m = params.get("m");
  if (m === "closest" || m === "center") state.method = m;
  const d = Number(params.get("d"));
  if (Number.isInteger(d) && d >= MIN_RADIUS && d <= MAX_RADIUS) state.d = d;
  return state;
}

export function toHash(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.pair) params.set("pair", state.pair);
  if (state.method) params.set("m", state.method);
  if (state.d != null) params.set("d", String(state.d));
  return `#${params.toString()}`;
}
