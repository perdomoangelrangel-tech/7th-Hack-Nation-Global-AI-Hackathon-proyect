"use client";
/**
 * Guide — the chatbot anchored to the floating "Guide" button (WAVE 6 · T4). OWNER: voice lane.
 *  - Chat: type → POST /api/ask (verified claims with source chips; "I couldn't find that in the graph" when empty);
 *    the mic button switches the same panel to the live ElevenLabs agent (it searches with the nedamex_* tools).
 *  - Transcript: the written route, one card per sentence with its kind badge and EVERY source as a link,
 *    "Show on the map", "Copy transcript". No audio here.
 *  - Talk: everything audio — "Play narration" (ElevenLabs TTS, synced sentence, captions, speed) and "Talk to the guide".
 * Opens from the button origin: spring scale 0.96→1 + fade (220 ms), reverse on close; reduced motion = fade only.
 * Focus moves to the input; Esc closes and returns focus to the button. Never a dead button (no key/mic → says so).
 * Mounted by AtlasApp (explorer lane) — props contract unchanged: { persona, locale, disease, diseaseName }.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { agentIds } from "@/lib/voice/agents";
import { setGuideOpen, useNarrationLink, type NarrationLink } from "@/lib/voice/bridge";
import { answerToTurn, askGraph, suggestions, trimTurns, type ChatTurn } from "@/lib/voice/chat";
import { stopSpeaking } from "@/lib/voice/client";
import { voiceCopy, type VoiceCopy } from "@/lib/voice/copy";
import { VOICE_LIVE_EVENT } from "@/lib/voice/events";
import { STATUS_STYLE } from "@/components/atlas/NarrationBar";
import { PersonaOrb } from "./PersonaOrb";
import { VoiceSettings } from "./VoiceSettings";
import type { Line, LiveState } from "./VoiceSession";

const VoiceSession = dynamic(() => import("./VoiceSession"), { ssr: false });

export interface VoiceDockProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string }

type TalkState = "idle" | "asking-mic" | LiveState;
type Tab = "chat" | "transcript" | "talk";
const TABS: Tab[] = ["chat", "transcript", "talk"];
const RATES = [0.8, 0.9, 1, 1.1, 1.2] as const;
const PANEL_MS = 0.22;

export function VoiceDock({ persona, locale, disease, diseaseName }: VoiceDockProps) {
  const t = voiceCopy(locale);
  const { prefs } = usePrefs();
  const osReduce = useReducedMotion();
  const calm = !!(prefs.reduceMotion || osReduce);
  const link = useNarrationLink();
  const agentId = agentIds()[persona];
  const mode = PERSONAS[persona].mode[locale];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [settings, setSettings] = useState(false);
  const [talk, setTalk] = useState<TalkState>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [endSignal, setEndSignal] = useState(0);
  const levelRef = useRef<() => number>(() => 0);
  const cancelled = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ids = useId();
  const live = talk === "connecting" || talk === "listening" || talk === "speaking";
  const callOn = live || talk === "asking-mic";
  const n = link?.n;
  const narrating = n?.state === "playing" || n?.state === "loading";

  // The caption strip over the map hides while the Guide shows the written route or plays audio.
  useEffect(() => { setGuideOpen(open && tab !== "chat"); }, [open, tab]);
  useEffect(() => () => setGuideOpen(false), []);

  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus()); }, []);

  // Esc closes from anywhere while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Focus the chat input when the panel opens on Chat.
  useEffect(() => {
    if (open && tab === "chat") { const id = window.setTimeout(() => inputRef.current?.focus(), 30); return () => window.clearTimeout(id); }
  }, [open, tab]);

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

  const orbState = talk === "speaking" || (tab === "talk" && n?.state === "playing") ? "speaking"
    : talk === "connecting" || talk === "asking-mic" ? "connecting"
    : talk === "listening" ? "listening" : "idle";

  const status = callOn
    ? (talk === "listening" ? (muted ? t.muted : t.listening) : talk === "speaking" ? t.speaking : t.connecting)
    : tab === "chat" ? t.about(diseaseName)
    : tab === "transcript" ? t.transcript_intro
    : n?.voice ? (n.voice === "elevenlabs" ? t.voice_eleven : t.voice_browser) : problem ?? t.talk_intro;

  const tabLabel: Record<Tab, string> = { chat: t.tab_chat, transcript: t.tab_transcript, talk: t.tab_talk };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {open && (
          <motion.section key="guide" id={`${ids}-panel`} role="dialog" aria-modal="false" aria-label={t.guide_title(mode)}
            initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={calm ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={calm ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={calm ? { duration: PANEL_MS, ease: "easeOut" } : { type: "spring", duration: PANEL_MS, bounce: 0.12 }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-auto w-[24rem] max-w-full h-[min(78vh,38rem)] flex flex-col rounded-2xl border border-line bg-paper/95 backdrop-blur-md shadow-xl shadow-brand-ink/10 text-ink">
            <header className="flex items-center gap-3 p-3 pb-2">
              <PersonaOrb persona={persona} state={orbState} size={64} reduce={prefs.reduceMotion} getLevel={() => levelRef.current()} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{t.guide_title(mode)}</h2>
                <p className="text-xs text-ink-2 line-clamp-2" role="status" aria-live="polite">{status}</p>
              </div>
              <IconButton label={t.settings} onClick={() => setSettings((s) => !s)} pressed={settings}>
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
              </IconButton>
              <IconButton label={t.close} onClick={close}><path d="M6 6l12 12M18 6L6 18" /></IconButton>
            </header>

            <div role="tablist" aria-label={t.guide} className="mx-3 grid grid-cols-3 rounded-xl bg-brand-mist p-1 text-sm">
              {TABS.map((k) => (
                <button key={k} type="button" role="tab" id={`${ids}-tab-${k}`} aria-selected={tab === k} aria-controls={`${ids}-pane-${k}`} onClick={() => setTab(k)}
                  className={`rounded-lg py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-brand ${tab === k ? "bg-paper text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}>
                  {tabLabel[k]}
                </button>
              ))}
            </div>

            {settings && <div className="px-3"><VoiceSettings persona={persona} locale={locale} /></div>}

            <div role="tabpanel" id={`${ids}-pane-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} className="min-h-0 flex-1 flex flex-col">
              {tab === "chat" && (
                <ChatPane persona={persona} locale={locale} disease={disease} t={t} inputRef={inputRef} calm={calm}
                  onMic={() => { setTab("talk"); if (!callOn) void startTalk(); }} micDisabled={!agentId} />
              )}
              {tab === "transcript" && <TranscriptPane link={link} disease={disease} persona={persona} locale={locale} t={t} />}
              {tab === "talk" && (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2 space-y-4">
                  <NarrationPlayer link={link} disease={disease} persona={persona} locale={locale} t={t} disabled={callOn} />
                  <section aria-label={t.talk_guide} className="border-t border-line pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t.talk_guide}</h3>
                    {!callOn && <p className="mt-1 text-sm text-ink-2">{t.talk_intro}</p>}
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
                        <button type="button" onClick={() => setTab("transcript")}
                          className="ml-auto rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
                          {t.tab_transcript}
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
            <p className="px-3 pb-2.5 pt-1 text-[11px] text-ink-3">{t.not_advice}</p>
          </motion.section>
        )}
      </AnimatePresence>

      <button ref={buttonRef} type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-controls={open ? `${ids}-panel` : undefined} aria-haspopup="dialog"
        className={`pointer-events-auto flex items-center gap-2 rounded-full pl-2 pr-4 py-2 shadow-lg shadow-brand-ink/15 border focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${callOn ? "bg-brand-ink text-paper border-brand-ink" : "bg-paper text-ink border-line hover:bg-brand-mist"}`}>
        <span className={`relative grid place-items-center w-9 h-9 rounded-full ${callOn ? "bg-paper/15" : "bg-brand-deep text-paper"}`} aria-hidden>
          {/* MessageCircle + AudioLines feel: chat bubble with sound bars */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /><path d="M9 10v3M12 8.5v6M15 10v3" /></svg>
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

// ───────────────────────────── Chat (text → /api/ask) ─────────────────────────────

function ChatPane({ persona, locale, disease, t, inputRef, calm, onMic, micDisabled }: {
  persona: PersonaId; locale: Locale; disease: string | null; t: VoiceCopy; inputRef: React.RefObject<HTMLTextAreaElement | null>;
  calm: boolean; onMic: () => void; micDisabled: boolean;
}) {
  const { prefs } = usePrefs();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: calm ? "auto" : "smooth" }); }, [turns, busy, calm]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const user: ChatTurn = { id: nextId.current++, role: "user", text: q };
    const history = turns;
    setTurns((ts) => trimTurns([...ts, user]));
    setDraft(""); setBusy(true);
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    try {
      const a = await askGraph({ question: q, persona, locale, focus: disease, history, simple: prefs.simpleLanguage }, ac.signal);
      setTurns((ts) => trimTurns([...ts, answerToTurn(a, nextId.current++, t.not_found_graph)]));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setTurns((ts) => trimTurns([...ts, { id: nextId.current++, role: "guide", text: t.chat_error, error: true }]));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2 space-y-2.5" aria-live="polite" aria-busy={busy}>
        {turns.length === 0 && (
          <div>
            <p className="text-sm text-ink-2">{t.chat_intro}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t.suggested}</p>
            <ul className="mt-1.5 space-y-1.5">
              {suggestions(persona, locale).map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => void send(s)}
                    className="w-full text-left rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {turns.map((m) => <ChatBubble key={m.id} m={m} t={t} />)}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-ink-3" role="status">
            <span className="inline-flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className={`w-1.5 h-1.5 rounded-full bg-brand ${calm ? "" : "animate-bounce"}`} style={{ animationDelay: `${i * 120}ms` }} />)}
            </span>
            {t.typing}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="flex items-end gap-2 border-t border-line p-2.5" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
        <label htmlFor="guide-input" className="sr-only">{t.chat_placeholder}</label>
        <textarea id="guide-input" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={500}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
          placeholder={t.chat_placeholder}
          className="min-h-12 max-h-28 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-brand" />
        <button type="button" onClick={onMic} disabled={micDisabled} aria-label={t.mic} title={t.mic}
          className="w-10 h-10 grid place-items-center rounded-full border border-line text-brand-deep hover:bg-brand-mist disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        <button type="submit" disabled={busy || !draft.trim()} aria-label={t.send} title={t.send}
          className="w-10 h-10 grid place-items-center rounded-full bg-brand-deep text-paper hover:bg-brand-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </>
  );
}

function ChatBubble({ m, t }: { m: ChatTurn; t: VoiceCopy }) {
  if (m.role === "user") {
    return <div className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-deep text-paper px-3 py-2 text-sm">{m.text}</p></div>;
  }
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-brand-mist px-3 py-2 text-sm text-ink">
      {m.notice && <p className="mb-1.5 text-xs text-amber">{m.notice}</p>}
      {m.claims?.length ? (
        <ul className="space-y-2">
          {m.claims.map((c, i) => (
            <li key={i}>
              <p>
                {c.status && STATUS_STYLE[c.status] && <span className={`inline-block align-middle mr-1.5 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[c.status]}`}>{c.status}</span>}
                {c.text}
              </p>
              {c.evidence.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.evidence.slice(0, 3).map((e) => (
                    <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-line bg-paper px-2 py-0.5 text-ink-2 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />{e.source} · {e.external_id.length > 22 ? `${e.external_id.slice(0, 21)}…` : e.external_id}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className={m.error ? "text-amber" : ""}>{m.text}</p>}
      {m.empty && <p className="mt-1 text-xs text-ink-3">{t.chat_intro}</p>}
    </div>
  );
}

// ───────────────────────────── Transcript (text only) ─────────────────────────────

function useLoadedNarration(link: NarrationLink | null, disease: string | null, persona: PersonaId, locale: Locale) {
  const n = link?.n;
  const want = !!(n && disease && !n.narration && (n.state === "idle" || n.state === "done"));
  useEffect(() => { if (want && n && disease) void n.prepare(disease, persona, locale); }, [want, n, disease, persona, locale]);
  return n;
}

function TranscriptPane({ link, disease, persona, locale, t }: { link: NarrationLink | null; disease: string | null; persona: PersonaId; locale: Locale; t: VoiceCopy }) {
  const n = useLoadedNarration(link, disease, persona, locale);
  const [copied, setCopied] = useState(false);
  if (!link || !n || !disease) return <p className="p-3 text-sm text-ink-2">{t.listen_pick}</p>;
  const dict = link.t;
  const claims = n.narration?.claims ?? [];

  async function copy() {
    const text = claims.map((c, i) => `${i + 1}. [${dict.status[c.status]}] ${c.text}\n${c.evidence.map((e) => `   - ${e.source} · ${e.external_id} · ${e.url}`).join("\n")}`).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
      <div className="flex items-center gap-2">
        <p className="text-xs text-ink-2 flex-1">{t.transcript_intro}</p>
        {claims.length > 0 && (
          <button type="button" onClick={copy} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-brand-deep hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand">
            {copied ? t.copied : t.copy_transcript}
          </button>
        )}
      </div>
      {n.state === "loading" && <p className="mt-3 text-sm text-ink-3" role="status">{dict.preparing}</p>}
      {n.state === "error" && <p className="mt-3 text-sm text-amber" role="alert">Narration is unavailable right now — read the route on the right.</p>}
      {claims.length > 0 && (
        <ol aria-label={t.transcript} className="mt-3 space-y-2.5">
          {claims.map((c, i) => (
            <li key={i} className={`rounded-xl border p-2.5 text-sm ${i === n.index ? "border-brand bg-brand-soft" : "border-line bg-paper"}`} aria-current={i === n.index ? "step" : undefined}>
              <p className="text-ink">
                <span className={`inline-block align-middle mr-1.5 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[c.status]}`}>{dict.status[c.status]}</span>
                {c.text}
              </p>
              {c.evidence.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{t.sources}</p>
                  <ul className="mt-1 space-y-0.5">
                    {c.evidence.map((e) => (
                      <li key={e.id}>
                        <a href={e.url} target="_blank" rel="noreferrer" className="text-xs text-brand-deep underline underline-offset-2 break-all hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand rounded">
                          {e.source} · {e.external_id}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(c.edges.length > 0 || c.nodes.length > 0) && (
                <button type="button" onClick={() => n.select(i)} className="mt-2 text-[11px] font-semibold text-brand-deep underline underline-offset-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand rounded">
                  {t.see_on_map}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ───────────────────────────── Talk: narration audio ─────────────────────────────

function NarrationPlayer({ link, disease, persona, locale, t, disabled }: { link: NarrationLink | null; disease: string | null; persona: PersonaId; locale: Locale; t: VoiceCopy; disabled: boolean }) {
  const { prefs, setPrefs } = usePrefs();
  const n = useLoadedNarration(link, disease, persona, locale);
  if (!link || !n || !disease) return <p className="text-sm text-ink-2">{t.listen_pick}</p>;
  const dict = link.t;
  const playing = n.state === "playing";
  const paused = n.state === "paused";
  const claims = n.narration?.claims ?? [];
  const cur = n.current;
  const play = () => (playing ? n.pause() : paused ? n.resume() : n.narration ? n.playLoaded(Math.max(0, n.index)) : link.onListen());
  return (
    <section aria-label={t.play_narration}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t.play_narration}</h3>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={play} disabled={n.state === "loading" || disabled}
          className="rounded-full bg-brand-deep text-paper px-4 py-1.5 text-xs font-semibold disabled:opacity-50 hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {playing ? dict.pause : paused ? dict.resume : n.state === "done" ? t.listen_again : t.play_narration}
        </button>
        {(playing || paused) && (
          <>
            <button type="button" onClick={n.prev} disabled={n.index <= 0} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 disabled:opacity-40 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand" aria-label={t.skip_prev}>←</button>
            <button type="button" onClick={n.next} disabled={n.index >= claims.length - 1} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 disabled:opacity-40 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand" aria-label={t.skip_next}>→</button>
            <span className="text-xs text-ink-3">{n.index + 1}/{claims.length}</span>
            <button type="button" onClick={n.stop} className="ml-auto text-xs text-ink-2 hover:text-ink px-2 py-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand">{dict.stop}</button>
          </>
        )}
      </div>
      {(playing || paused) && cur && prefs.captions && (
        <p className="mt-2 rounded-xl border border-brand bg-brand-soft p-2.5 text-sm text-ink">
          <span className={`inline-block align-middle mr-1.5 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[cur.status]}`}>{dict.status[cur.status]}</span>
          {cur.text}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2">
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
    </section>
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
