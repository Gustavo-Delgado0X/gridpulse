// Typed API client over the read-only GridPulse API.
import type { Change, Envelope, Health, Method, Opportunity, OpportunityDetail, Project, Quality } from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("network", "Cannot reach the GridPulse API. Is the backend running?");
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body || body.error) {
    throw new ApiError(body?.error?.code ?? "http_" + res.status, body?.error?.message ?? res.statusText);
  }
  return body.data as T;
}

export interface OpportunityQuery {
  d: number;
  method: Method;
}

export const api = {
  health: (signal?: AbortSignal) => get<Health>("/health", signal),
  opportunities: (q: OpportunityQuery, signal?: AbortSignal) =>
    get<Opportunity[]>(`/opportunities?d=${q.d}&method=${q.method}`, signal),
  opportunity: (id: string, method: Method, signal?: AbortSignal) =>
    get<OpportunityDetail>(`/opportunities/${encodeURIComponent(id)}?method=${method}`, signal),
  projects: (signal?: AbortSignal) => get<Project[]>("/projects?located=true", signal),
  quality: (signal?: AbortSignal) => get<Quality>("/quality", signal),
  changes: (signal?: AbortSignal) => get<Change[]>("/changes", signal),
  csvUrl: (q: OpportunityQuery) => `${API_BASE}/export/overlaps.csv?d=${q.d}&method=${q.method}`,
  briefUrl: (id: string, method: Method) => `${API_BASE}/opportunities/${encodeURIComponent(id)}/brief?method=${method}`,
};
