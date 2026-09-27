import { useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "playing" | "paused" | "error";

interface Props {
  /** MP3 of the briefing, read aloud by ElevenLabs on the server. */
  audioUrl: string;
  /** The exact words spoken, loaded only when the transcript is opened. */
  loadScript: () => Promise<string>;
}

const VERB: Record<State, string> = { idle: "Listen to", loading: "Loading", playing: "Pause", paused: "Resume", error: "Retry" };
const GLYPH: Record<State, string> = { idle: "▶", loading: "…", playing: "❚❚", paused: "▶", error: "↻" };

/** Spoken briefing for one pair: play/pause/retry plus a transcript of exactly what the voice says. */
export function VoiceBrief({ audioUrl, loadScript }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<State>("idle");
  const [script, setScript] = useState<string | null>(null);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const on: [string, () => void][] = [
      ["playing", () => setState("playing")], ["pause", () => setState((s) => (s === "playing" ? "paused" : s))],
      ["ended", () => setState("idle")], ["error", () => setState("error")], ["waiting", () => setState("loading")],
    ];
    for (const [name, fn] of on) el.addEventListener(name, fn);
    return () => { for (const [name, fn] of on) el.removeEventListener(name, fn); };
  }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (state === "playing") { el.pause(); return; }
    if (state === "idle" || state === "error") {
      el.src = audioUrl;
      setState("loading");
    }
    el.play().catch(() => setState("error"));
  };

  const openTranscript = () => {
    if (script !== null) return;
    setScript("");
    loadScript().then(setScript).catch(() => setScript("Transcript unavailable."));
  };

  return (
    <div className="voice-brief">
      <button type="button" className="btn voice-brief__play" onClick={toggle} disabled={state === "loading"}
              aria-label={`${VERB[state]} voice briefing`}>
        <span aria-hidden="true">{GLYPH[state]}</span> {state === "idle" ? "Listen to briefing" : VERB[state]}
      </button>
      <span className="voice-brief__credit small muted">Voice by ElevenLabs · script from cited facts only</span>
      <p role="status" className="voice-brief__status small">{state === "error" ? "Voice briefing could not load. Try again." : ""}</p>
      <details className="voice-brief__transcript" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) openTranscript(); }}>
        <summary>Transcript</summary>
        <p className="small">{script || "Loading…"}</p>
      </details>
      <audio ref={audio} preload="none" />
    </div>
  );
}
