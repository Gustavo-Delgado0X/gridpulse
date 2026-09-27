import { useEffect, useState } from "react";
import { api } from "../api";
import type { Opportunity, OpportunityDetail, Quality } from "../types";
import { sharedEndpoint } from "../landingData";
import { Landing, type SourceFact } from "./Landing";

const FEATURED_ID = "desc-2428-6367-d-g__gpc-20065";

/** Loads the live numbers for the landing page; renders immediately with the documented fallbacks. */
export function LandingPage() {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [changes, setChanges] = useState<number | null>(null);
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [top, setTop] = useState<OpportunityDetail | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const quiet = () => undefined; // the page stays useful with fallback numbers if the API is unreachable
    api.opportunities({ d: 25, method: "closest" }, controller.signal)
      .then((list) => {
        setOpps(list);
        if (list[0]) return api.opportunity(list[0].id, "closest", controller.signal).then(setTop);
      })
      .catch(quiet);
    api.quality(controller.signal).then(setQuality).catch(quiet);
    api.changes(controller.signal).then((c) => setChanges(c.length)).catch(quiet);
    api.opportunity(FEATURED_ID, "closest", controller.signal).then(setDetail).catch(quiet);
    document.documentElement.dataset.theme = "light";
    document.title = "GridPulse · Where transmission plans meet";
    return () => controller.abort();
  }, []);

  const dateQuote = detail?.project_a.evidence.find((e) => e.field === "in_service_date");
  const sourceFact: SourceFact | null = detail && dateQuote
    ? { name: detail.project_a.name, printed: dateQuote.quote, source_id: dateQuote.source_id, page: dateQuote.page } : null;
  return (
    <Landing stats={{ projects: quality?.coverage.projects ?? null, pairs: opps?.length ?? null, changes, acceptance: quality?.acceptance ?? null,
                    independent: quality?.independent ?? null }}
             featured={opps?.find((o) => o.id === FEATURED_ID) ?? null} finding={opps?.[0] ?? null} shared={sharedEndpoint(top)}
             quality={quality} sourceFact={sourceFact} />
  );
}
