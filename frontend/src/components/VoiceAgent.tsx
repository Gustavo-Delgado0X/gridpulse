import { VoiceConversation } from "@elevenlabs/client";
import { useEffect, useRef, useState } from "react";
import { dataQuality, listOpportunities, opportunityFacts, planChanges, studySummary } from "../agentTools";
import { api } from "../api";
import type { Opportunity } from "../types";

type Status = "idle" | "connecting" | "connected" | "error";
interface Line { who: "you" | "analyst"; text: string }

const STUDY = { d: 25, method: "closest" as const };
const MODE_TEXT = { speaking: "Speaking", listening: "Listening" };

/**
 * "Talk to the GridPulse analyst": a voice conversation with an ElevenLabs agent. The agent answers only through the
 * client tools below, which read the live GridPulse API; our server hands out a signed session URL so the key never
 * reaches the browser.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onShow: (opportunityId: string) => void;
}

export function VoiceAgent({ open, onClose, onShow }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<"speaking" | "listening">("listening");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<{ endSession: () => Promise<void> } | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const show = useRef(onShow);
  show.current = onShow;

  useEffect(() => { logRef.current?.lastElementChild?.scrollIntoView?.({ block: "nearest" }); }, [lines]);
  useEffect(() => () => { void session.current?.endSession(); }, []);

  const ranked = () => api.opportunities(STUDY);
  const byRank = async (rank: unknown): Promise<Opportunity | undefined> =>
    (await ranked()).find((o) => o.rank === Number(rank));
  const json = (value: unknown) => JSON.stringify(value);

  const clientTools = {
    get_study_summary: async () => {
      const [opps, changes, quality] = await Promise.all([ranked(), api.changes(), api.quality()]);
      return json(studySummary(opps, changes, quality));
    },
    list_opportunities: async (p: { tier?: string; limit?: number }) => json(listOpportunities(await ranked(), p)),
    get_opportunity: async (p: { rank: number }) => {
      const pair = await byRank(p.rank);
      if (!pair) return `No pair with rank ${p.rank} within 25 miles.`;
      const [detail, changes] = await Promise.all([api.opportunity(pair.id, STUDY.method), api.changes()]);
      return json(opportunityFacts(detail, changes));
    },
    get_plan_changes: async (p: { query: string }) => json(planChanges(await api.changes(), String(p.query ?? ""))),
    get_data_quality: async () => json(dataQuality(await api.quality())),
    show_opportunity: async (p: { rank: number }) => {
      const pair = await byRank(p.rank);
      if (!pair) return `No pair with rank ${p.rank} within 25 miles.`;
      show.current(pair.id);
      return `Opened pair ${pair.rank} on screen: ${pair.a.name} and ${pair.b.name}.`;
    },
  };

  const start = async () => {
    setError(null);
    setLines([]);
    setStatus("connecting");
    try {
      const { signed_url } = await api.voiceSession();
      session.current = await VoiceConversation.startSession({
        signedUrl: signed_url,
        connectionType: "websocket",
        clientTools: clientTools as unknown as Record<string, (p: unknown) => Promise<string>>,
        onStatusChange: ({ status: s }) => setStatus(s === "connected" ? "connected" : s === "disconnected" ? "idle" : "connecting"),
        onModeChange: ({ mode: m }) => setMode(m),
        onMessage: ({ message, role }) => setLines((l) => [...l, { who: role === "user" ? "you" : "analyst", text: message }]),
        onError: (message) => { setError(`Voice analyst error: ${message}`); setStatus("error"); },
      });
    } catch (err) {
      setError(`Could not start the voice analyst. ${err instanceof Error ? err.message : ""} Check microphone access and try again.`);
      setStatus("error");
    }
  };

  const end = async () => {
    await session.current?.endSession();
    session.current = null;
    setStatus("idle");
  };

  useEffect(() => {
    if (open && status === "idle" && !session.current) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => { void end(); onClose(); };

  if (!open) return null;
  const live = status === "connecting" || status === "connected";
  return (
    <div className="voice-agent">
      {(
        <section className="voice-agent__panel" aria-label="GridPulse voice analyst">
          <header className="voice-agent__head">
            <span className={`voice-agent__dot voice-agent__dot--${live ? mode : "off"}`} aria-hidden="true" />
            <strong>GridPulse analyst</strong>
            <span className="muted small">{status === "connecting" ? "Connecting…" : status === "connected" ? MODE_TEXT[mode] : "Not connected"}</span>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={close} aria-label="Close voice analyst">×</button>
          </header>
          {error && <p role="alert" className="voice-agent__error small">{error}</p>}
          <ol ref={logRef} className="voice-agent__log" role="log" aria-label="Conversation">
            {lines.length === 0 && <li className="muted small">Ask about the top pairs, a specific pair ("show me pair four"),
              plan changes, or data quality. Answers come only from GridPulse data, with page citations.</li>}
            {lines.map((l, i) => <li key={i} className={`voice-agent__line voice-agent__line--${l.who}`}><span className="small muted">{l.who === "you" ? "You" : "Analyst"}</span>{l.text}</li>)}
          </ol>
          <footer className="voice-agent__foot">
            {live
              ? <button type="button" className="btn" onClick={() => void end()}>End conversation</button>
              : <button type="button" className="btn btn--primary" onClick={() => void start()}>Start again</button>}
            <span className="small muted">Voice by ElevenLabs · candidates for human review</span>
          </footer>
        </section>
      )}
    </div>
  );
}
