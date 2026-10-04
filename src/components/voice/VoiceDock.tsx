"use client";
/**
 * S8 · Guide — one dock for everything the AI says out loud. OWNER: voice lane.
 *  - "Listen": reads the current route (the same narration AtlasApp highlights on the map, via the voice
 *    bridge). Transcript sentences carry their evidence chips; "Show on the map" jumps to that claim.
 *  - "Talk": live ElevenLabs agent for the current mode, SDK loaded only after a click.
 * Never a dead button: without an agent, mic, or network the tab says so and points to Listen / the route.
 * Mounted by AtlasApp (explorer lane) — props contract unchanged: { persona, locale, disease, diseaseName }.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AgentOrb } from "@/components/three/AgentOrb";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { agentIds } from "@/lib/voice/agents";
import { setGuideOpen, useNarrationLink } from "@/lib/voice/bridge";
import { stopSpeaking } from "@/lib/voice/client";
import { voiceCopy, type VoiceCopy } from "@/lib/voice/copy";
import { VOICE_LIVE_EVENT } from "@/lib/voice/events";
import { STATUS_STYLE } from "@/components/atlas/NarrationBar";
import { VoiceSettings } from "./VoiceSettings";
import type { Line, LiveState } from "./VoiceSession";

const VoiceSession = dynamic(() => import("./VoiceSession"), { ssr: false });

export interface VoiceDockProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string }

type TalkState = "idle" | "asking-mic" | LiveState;
type Tab = "listen" | "talk";
const RATES = [0.8, 0.9, 1, 1.1, 1.2] as const;

export function VoiceDock({ persona, locale, disease, diseaseName }: VoiceDockProps) {
  const t = voiceCopy(locale);
  const { prefs, setPrefs } = usePrefs();
  const link = useNarrationLink();
  const agentId = agentIds()[persona];
  const mode = PERSONAS[persona].mode[locale];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("listen");
  const [settings, setSettings] = useState(false);
  const [talk, setTalk] = useState<TalkState>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [endSignal, setEndSignal] = useState(0);
  const levelRef = useRef<() => number>(() => 0);
  const cancelled = useRef(false);
  const ids = useId();
  const live = talk === "connecting" || talk === "listening" || talk === "speaking";
  const callOn = live || talk === "asking-mic";
  const n = link?.n;
  const narrating = n?.state === "playing" || n?.state === "loading";

  useEffect(() => { setGuideOpen(open && tab === "listen"); }, [open, tab]);
  useEffect(() => () => setGuideOpen(false), []);

  const end = useCallback(() => {
    cancelled.current = true;
    setEndSignal((x) => x + 1);
    setTalk((s) => (s === "asking-mic" ? "idle" : s));
  }, []);

  // Each mode has its own agent and voice: switching mode ends the call.
  const lastPersona = useRef(persona);
  useEffect(() => {
    if (lastPersona.current !== persona && callOn) end();
    lastPersona.current = persona;
  }, [persona, callOn, end]);

  const startTalk = useCallback(async () => {
    setProblem(null);
    if (!agentId) { setProblem(t.not_configured); return; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setProblem(t.unavailable); return; }
    cancelled.current = false;
    setLines([]); setMuted(false); setTalk("asking-mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
    } catch (e) {
      const name = (e as DOMException)?.name;
      setProblem(name === "NotFoundError" || name === "OverconstrainedError" ? t.no_mic : t.mic_denied);
      setTalk("idle");
      return;
    }
    if (cancelled.current) return;
    stopSpeaking();
    window.dispatchEvent(new Event(VOICE_LIVE_EVENT)); // narration stops: two voices never overlap
    setTalk("connecting");
  }, [agentId, t]);

  const onState = useCallback((s: LiveState, p?: string) => {
    setTalk(s === "ended" ? "idle" : s === "error" ? "idle" : s);
    if (p) setProblem(p);
  }, []);
  const onLine = useCallback((l: Line) => setLines((ls) => [...ls.slice(-19), l]), []);

  const orbState = talk === "speaking" || (tab === "listen" && narrating) ? "speaking"
    : talk === "connecting" || talk === "asking-mic" ? "connecting"
    : talk === "listening" ? "listening" : "idle";

  const status = tab === "talk"
    ? (talk === "connecting" || talk === "asking-mic" ? t.connecting : talk === "listening" ? (muted ? t.muted : t.listening) : talk === "speaking" ? t.speaking : problem ?? (agentId ? t.about(diseaseName) : t.not_configured))
    : (!n || !disease ? t.listen_pick : n.state === "loading" ? link!.t.preparing : n.voice ? (n.voice === "elevenlabs" ? t.voice_eleven : t.voice_browser) : t.listen_intro);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)]">
      {open && (
        <section id={`${ids}-panel`} aria-label={t.guide_title(mode)}
          className="pointer-events-auto w-[23rem] max-w-full max-h-[min(80vh,40rem)] flex flex-col rounded-2xl border border-line bg-paper/95 backdrop-blur-md shadow-xl shadow-brand-ink/10 text-ink">
          <header className="flex items-center gap-3 p-3 pb-2">
            <AgentOrb state={orbState} size={72} reduce={prefs.reduceMotion} getLevel={() => levelRef.current()} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{t.guide_title(mode)}</h2>
              <p className="text-xs text-ink-2" role="status" aria-live="polite">{status}</p>
            </div>
            <IconButton label={t.settings} onClick={() => setSettings((s) => !s)} pressed={settings}>
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
            </IconButton>
            <IconButton label={t.close} onClick={() => setOpen(false)}><path d="M6 6l12 12M18 6L6 18" /></IconButton>
          </header>

          <div role="tablist" aria-label={t.guide} className="mx-3 grid grid-cols-2 rounded-xl bg-brand-mist p-1 text-sm">
            {(["listen", "talk"] as const).map((k) => (
              <button key={k} role="tab" id={`${ids}-tab-${k}`} aria-selected={tab === k} aria-controls={`${ids}-pane-${k}`} onClick={() => setTab(k)}
                className={`rounded-lg py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-brand ${tab === k ? "bg-paper text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}>
                {k === "listen" ? t.tab_listen : t.tab_talk}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
            {settings && <VoiceSettings persona={persona} locale={locale} />}

            {tab === "listen" ? (
              <div role="tabpanel" id={`${ids}-pane-listen`} aria-labelledby={`${ids}-tab-listen`}>
                <ListenPane link={link} disease={disease} t={t} />
                {n && disease && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2">
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={prefs.captions} onChange={(e) => setPrefs({ captions: e.target.checked })} className="accent-[var(--brand-deep)]" />
                      {t.captions}
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      {t.speed}
                      <select value={prefs.voiceRate} onChange={(e) => setPrefs({ voiceRate: Number(e.target.value) })}
                        className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-ink focus-visible:outline-2 focus-visible:outline-brand">
                        {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
                      </select>
                    </label>
                    <span className="hidden md:inline text-ink-3">{t.shortcuts}</span>
                  </div>
                )}
              </div>
            ) : (
              <div role="tabpanel" id={`${ids}-pane-talk`} aria-labelledby={`${ids}-tab-talk`}>
                {!callOn && <p className="text-sm text-ink-2">{t.talk_intro}</p>}
                {problem && !callOn && <p className="mt-2 rounded-lg border border-line bg-brand-mist p-2 text-sm text-ink" role="alert">{problem}</p>}
                {(prefs.captions || !live) && lines.length > 0 && (
                  <ol aria-label={t.transcript} className="mt-2 space-y-1.5 text-sm">
                    {lines.map((l) => (
                      <li key={l.id} className={l.who === "user" ? "text-ink-2" : "text-ink"}>
                        <span className="font-semibold mr-1">{l.who === "user" ? t.you : t.agent}:</span>{l.text}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="sr-only" aria-live="polite">{lines.filter((l) => l.who === "agent").at(-1)?.text ?? ""}</p>
                <div className="mt-3 flex items-center gap-2">
                  {callOn ? (
                    <>
                      <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted}
                        className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
                        {muted ? t.unmute : t.mute}
                      </button>
                      <button type="button" onClick={end} className="ml-auto rounded-full bg-brand-ink text-paper px-4 py-1.5 text-xs font-semibold hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                        {t.end}
                      </button>
                    </>
                  ) : agentId ? (
                    <button type="button" onClick={startTalk}
                      className="ml-auto rounded-full bg-brand-deep text-paper px-4 py-1.5 text-xs font-semibold hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                      {t.talk_mode(mode)}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setTab("listen")}
                      className="ml-auto rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
                      {t.tab_listen}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="px-3 pb-3 text-[11px] text-ink-3">{t.not_advice}</p>
        </section>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? `${ids}-panel` : undefined}
        className={`pointer-events-auto flex items-center gap-2 rounded-full pl-2 pr-4 py-2 shadow-lg shadow-brand-ink/15 border focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${callOn ? "bg-brand-ink text-paper border-brand-ink" : "bg-paper text-ink border-line hover:bg-brand-mist"}`}>
        <span className={`relative grid place-items-center w-9 h-9 rounded-full ${callOn ? "bg-paper/15" : "bg-brand-deep text-paper"}`} aria-hidden>
          {/* AudioLines */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3" /></svg>
          {(callOn || narrating) && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand ring-2 ring-paper" />}
        </span>
        <span className="text-sm font-semibold">{t.guide}</span>
      </button>

      {agentId && live && (
        <VoiceSession agentId={agentId} persona={persona} locale={locale} disease={disease} diseaseName={diseaseName}
          copy={t} onState={onState} onLine={onLine} endSignal={endSignal} muted={muted} levelRef={levelRef} />
      )}
    </div>
  );
}

function ListenPane({ link, disease, t }: { link: ReturnType<typeof useNarrationLink>; disease: string | null; t: VoiceCopy }) {
  if (!link || !disease) return <p className="text-sm text-ink-2">{t.listen_pick}</p>;
  const { n, onListen, t: dict } = link;
  const playing = n.state === "playing";
  const paused = n.state === "paused";
  const claims = n.narration?.claims ?? [];
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (playing ? n.pause() : paused ? n.resume() : onListen())} disabled={n.state === "loading"}
          className="rounded-full bg-brand-deep text-paper px-4 py-1.5 text-xs font-semibold disabled:opacity-60 hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {playing ? dict.pause : paused ? dict.resume : n.state === "done" ? t.listen_again : t.listen_start}
        </button>
        {(playing || paused) && (
          <>
            <button type="button" onClick={n.prev} disabled={n.index <= 0} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 disabled:opacity-40 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand" aria-label={t.skip_prev}>←</button>
            <button type="button" onClick={n.next} disabled={n.index >= claims.length - 1} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 disabled:opacity-40 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand" aria-label={t.skip_next}>→</button>
            <button type="button" onClick={n.stop} className="ml-auto text-xs text-ink-2 hover:text-ink px-2 py-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand">{dict.stop}</button>
          </>
        )}
      </div>
      {n.state === "error" && <p className="mt-2 text-sm text-amber" role="alert">Narration is unavailable right now — read the route on the right.</p>}
      {claims.length > 0 && (
        <ol aria-label={t.transcript} className="mt-3 space-y-2">
          {claims.map((c, i) => (
            <li key={i} className={`rounded-lg border p-2 text-sm ${i === n.index ? "border-brand bg-brand-soft" : "border-line bg-paper"}`} aria-current={i === n.index ? "step" : undefined}>
              <p className="text-ink">
                <span className={`inline-block align-middle mr-1.5 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[c.status]}`}>{dict.status[c.status]}</span>
                {c.text}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {c.evidence.slice(0, 3).map((e) => (
                  <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-line bg-brand-mist px-2 py-0.5 text-ink-2 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />{e.source} · {e.external_id.length > 24 ? `${e.external_id.slice(0, 23)}…` : e.external_id}
                  </a>
                ))}
                {(c.edges.length > 0 || c.nodes.length > 0) && (
                  <button type="button" onClick={() => n.jump(i)} className="text-[11px] font-semibold text-brand-deep underline underline-offset-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand rounded">
                    {t.see_on_map}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function IconButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed}
      className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>{children}</svg>
    </button>
  );
}
