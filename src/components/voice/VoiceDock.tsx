"use client";
/**
 * Live voice conversation with the persona's ElevenLabs agent ("Talk to Nexmed").
 * OWNER: voice lane. Mounted by AtlasApp (explorer lane) — keep this props contract stable.
 * The ElevenLabs SDK is loaded only after the user clicks (dynamic import), never before a gesture.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { agentIds } from "@/lib/voice/agents";
import { stopSpeaking } from "@/lib/voice/client";
import { voiceCopy } from "@/lib/voice/copy";
import { VOICE_LIVE_EVENT } from "@/lib/voice/events";
import { AgentOrb } from "./AgentOrb";
import { VoiceSettings } from "./VoiceSettings";
import type { Line, LiveState } from "./VoiceSession";

const VoiceSession = dynamic(() => import("./VoiceSession"), { ssr: false });

export interface VoiceDockProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string }

type DockState = "idle" | "asking-mic" | LiveState;

export function VoiceDock({ persona, locale, disease, diseaseName }: VoiceDockProps) {
  const t = voiceCopy(locale);
  const { prefs } = usePrefs();
  const agentId = agentIds()[persona];
  const mode = PERSONAS[persona].mode[locale];
  const [state, setState] = useState<DockState>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [endSignal, setEndSignal] = useState(0);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const panelId = useId();
  const logRef = useRef<HTMLOListElement>(null);
  const cancelled = useRef(false);
  const live = state === "connecting" || state === "listening" || state === "speaking";
  const sessionOn = live || state === "asking-mic";

  useEffect(() => { logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [lines]);

  const end = useCallback(() => {
    cancelled.current = true;
    setEndSignal((n) => n + 1);
    setState((s) => (s === "asking-mic" ? "idle" : s));
  }, []);

  // Persona switch mid-call → end the call (each mode has its own agent and voice).
  const lastPersona = useRef(persona);
  useEffect(() => {
    if (lastPersona.current !== persona && sessionOn) end();
    lastPersona.current = persona;
  }, [persona, sessionOn, end]);

  const start = useCallback(async () => {
    if (!agentId) { setOpen(true); return; }
    cancelled.current = false;
    setProblem(null); setLines([]); setOpen(true); setMuted(false);
    setState("asking-mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
    } catch {
      setProblem(t.mic_denied); setState("error");
      return;
    }
    if (cancelled.current) return;
    stopSpeaking();
    window.dispatchEvent(new Event(VOICE_LIVE_EVENT)); // narration stops so two voices never overlap
    setState("connecting");
  }, [agentId, t.mic_denied]);

  const onState = useCallback((s: LiveState, p?: string) => { setState(s); if (p) setProblem(p); }, []);
  const onLine = useCallback((l: Line) => setLines((ls) => [...ls.slice(-19), l]), []);

  const status = state === "connecting" || state === "asking-mic" ? t.connecting
    : state === "listening" ? (muted ? t.unmute : t.listening)
    : state === "speaking" ? t.speaking
    : problem ?? (agentId ? t.about(diseaseName) : t.not_configured);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)]">
      {open && (
        <section id={panelId} aria-label={t.talk_mode(mode)}
          className="pointer-events-auto w-[22rem] max-w-full rounded-2xl border border-line bg-paper/95 backdrop-blur-md shadow-xl shadow-brand-ink/10 p-4 text-ink">
          <header className="flex items-start gap-3">
            <AgentOrb state={state === "speaking" ? "speaking" : live ? "listening" : "idle"} reduce={prefs.reduceMotion} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{t.talk_mode(mode)}</h2>
              <p className="text-xs text-ink-2" role="status" aria-live="polite">{status}</p>
            </div>
            <button onClick={() => setSettings((s) => !s)} aria-expanded={settings} aria-label={t.settings} title={t.settings}
              className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
            </button>
            <button onClick={() => { if (sessionOn) end(); setOpen(false); }} aria-label={t.close} title={t.close}
              className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          {settings && <VoiceSettings persona={persona} locale={locale} />}

          {(prefs.captions || !live) && lines.length > 0 && (
            <ol ref={logRef} aria-label={t.transcript} className="mt-3 max-h-48 overflow-y-auto space-y-1.5 text-sm">
              {lines.map((l) => (
                <li key={l.id} className={l.who === "user" ? "text-ink-2" : "text-ink"}>
                  <span className="font-semibold mr-1">{l.who === "user" ? t.you : t.agent}:</span>{l.text}
                </li>
              ))}
            </ol>
          )}
          {/* Screen readers hear each agent line even when captions are hidden */}
          <p className="sr-only" aria-live="polite">{lines.filter((l) => l.who === "agent").at(-1)?.text ?? ""}</p>

          <div className="mt-3 flex items-center gap-2">
            {sessionOn ? (
              <>
                <button onClick={() => setMuted((m) => !m)} aria-pressed={muted}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
                  {muted ? t.unmute : t.mute}
                </button>
                <button onClick={end} className="ml-auto rounded-full bg-brand-ink text-paper px-4 py-1.5 text-xs font-semibold hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  {t.end}
                </button>
              </>
            ) : (
              <button onClick={start} disabled={!agentId}
                className="ml-auto rounded-full bg-brand-deep text-paper px-4 py-1.5 text-xs font-semibold disabled:opacity-50 hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {t.talk}
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-ink-3">{t.not_advice}</p>
        </section>
      )}

      <button onClick={() => (sessionOn ? end() : open ? setOpen(false) : start())}
        aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={sessionOn ? t.end : t.talk_mode(mode)}
        className={`pointer-events-auto flex items-center gap-2 rounded-full pl-2 pr-4 py-2 shadow-lg shadow-brand-ink/15 border focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${sessionOn ? "bg-brand-ink text-paper border-brand-ink" : "bg-paper text-ink border-line hover:bg-brand-mist"}`}>
        <span className={`grid place-items-center w-9 h-9 rounded-full ${sessionOn ? "bg-paper/15" : "bg-brand-deep text-paper"}`} aria-hidden>
          {sessionOn
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
        </span>
        <span className="text-sm font-semibold">{sessionOn ? t.end : t.talk}</span>
      </button>

      {agentId && live && (
        <VoiceSession agentId={agentId} persona={persona} locale={locale} disease={disease} diseaseName={diseaseName}
          copy={t} onState={onState} onLine={onLine} endSignal={endSignal} muted={muted} />
      )}
    </div>
  );
}
