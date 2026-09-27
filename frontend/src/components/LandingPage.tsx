import { useEffect, useState } from "react";
import { api } from "../api";
import type { Opportunity, OpportunityDetail, Quality } from "../types";
import { Landing, type SourceFact } from "./Landing";

const FEATURED_ID = "desc-2428-6367-d-g__gpc-20065";
const FEATURED_CONFLICT = "gpc-19523";

/** Loads the live numbers for the landing page; renders immediately with the documented fallbacks. */
export function LandingPage() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [changes, setChanges] = useState<number | null>(null);
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const quiet = () => undefined; // the page stays useful with fallback numbers if the API is unreachable
    api.opportunities({ d: 25, method: "closest" }, controller.signal).then(setOpps).catch(quiet);
    api.quality(controller.signal).then(setQuality).catch(quiet);
    api.changes(controller.signal).then((c) => setChanges(c.length)).catch(quiet);
    api.opportunity(FEATURED_ID, "closest", controller.signal).then(setDetail).catch(quiet);
    document.documentElement.dataset.theme = "light";
    document.title = "GridPulse · Where transmission plans meet";
    return () => controller.abort();
  }, []);

  const conflict = quality?.discrepancies.find((d) => d.project_id === FEATURED_CONFLICT) ?? null;
  const dateQuote = detail?.project_a.evidence.find((e) => e.field === "in_service_date");
  const sourceFact: SourceFact | null = detail && dateQuote
    ? { name: detail.project_a.name, printed: dateQuote.quote, source_id: dateQuote.source_id, page: dateQuote.page } : null;
  return (
    <Landing stats={{ projects: quality?.coverage.projects ?? null, pairs: opps?.length ?? null, changes, acceptance: quality?.acceptance ?? null,
                    independent: quality?.independent ?? null }}
             featured={opps?.find((o) => o.id === FEATURED_ID) ?? null} quality={quality}
             conflict={conflict ? { message: conflict.message, project_id: conflict.project_id } : null} sourceFact={sourceFact} />
  );
}
