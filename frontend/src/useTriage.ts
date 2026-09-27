// Per-browser triage status (contracts §5 U9). Storage can be unavailable: the app works without it.
import { useCallback, useState } from "react";
import type { Triage } from "./types";

const KEY = "gridpulse.triage.v1";

function load(): Record<string, Triage> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, Triage>;
  } catch {
    return {};
  }
}

export function useTriage() {
  const [state, setState] = useState<Record<string, Triage>>(load);
  const set = useCallback((id: string, value: Triage) => {
    setState((current) => {
      const next = { ...current, [id]: value };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: keep the in-memory value only.
      }
      return next;
    });
  }, []);
  return [state, set] as const;
}
