import { useEffect, useState } from "react";
import { api } from "../api";
import type { Opportunity, Quality } from "../types";
import { Landing } from "./Landing";

const FEATURED_ID = "desc-2428-6367-d-g__gpc-20065";
const FEATURED_CONFLICT = "gpc-19523";

/** Loads the live numbers for the landing page; renders immediately with the documented fallbacks. */
export function LandingPage() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [changes, setChanges] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const quiet = () => undefined; // the page stays useful with fallback numbers if the API is unreachable
    api.opportunities({ d: 25, method: "closest" }, controller.signal).then(setOpps).catch(quiet);
    api.quality(controller.signal).then(setQuality).catch(quiet);
    api.changes(controller.signal).then((c) => setChanges(c.length)).catch(quiet);
    document.documentElement.dataset.theme = "light";
    document.title = "GridPulse · Where transmission plans meet";
    return () => controller.abort();
  }, []);

  const conflict = quality?.discrepancies.find((d) => d.project_id === FEATURED_CONFLICT) ?? null;
  return (
    <Landing stats={{ projects: quality?.coverage.projects ?? null, pairs: opps?.length ?? null, changes, acceptance: quality?.acceptance ?? null }}
             featured={opps?.find((o) => o.id === FEATURED_ID) ?? null} quality={quality}
             conflict={conflict ? { message: conflict.message, project_id: conflict.project_id } : null} />
  );
}
