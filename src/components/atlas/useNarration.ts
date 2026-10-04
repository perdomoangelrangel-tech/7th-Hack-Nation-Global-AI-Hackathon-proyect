"use client";
/**
 * Plays the verified narration claim by claim and exposes the current claim so the graph can
 * highlight its nodes/edges (contract used by AtlasApp: `current.nodes` / `current.edges`).
 * Voice: ElevenLabs persona voice via /api/speak, next claim prefetched; 503 → browser speech.
 * Speed follows usePrefs().voiceRate, plain language follows prefs.simpleLanguage; voice choice follows the
 * voice lane's prefs. OWNER: voice lane.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Narration } from "@/lib/atlas/narrate";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { fetchSpeech, playUrl, speakBrowser, type VoiceProvider } from "@/lib/voice/client";
import { VOICE_LIVE_EVENT } from "@/lib/voice/events";

export type NarrationState = "idle" | "loading" | "ready" | "playing" | "paused" | "done" | "error";

export function useNarration() {
  const { prefs } = usePrefs();
  const [state, setState] = useState<NarrationState>("idle");
  const [narration, setNarration] = useState<Narration | null>(null);
  const [index, setIndex] = useState(-1);
  const [voice, setVoice] = useState<VoiceProvider | null>(null);
  const run = useRef(0);                                   // invalidates previous playbacks
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Promise<string | null>>());
  const ctx = useRef<{ persona: PersonaId; locale: Locale }>({ persona: "maria", locale: "en" });
  const rate = useRef(prefs.voiceRate);
  useEffect(() => { rate.current = prefs.voiceRate; }, [prefs.voiceRate]);
  const simple = useRef(prefs.simpleLanguage);
  useEffect(() => { simple.current = prefs.simpleLanguage; }, [prefs.simpleLanguage]);

  const fetchAudio = useCallback((n: Narration, i: number): Promise<string | null> => {
    if (i >= n.claims.length) return Promise.resolve(null);
    if (!cache.current.has(i)) cache.current.set(i, fetchSpeech(n.claims[i].text, { ...ctx.current, rate: rate.current }));
    return cache.current.get(i)!;
  }, []);

  const halt = useCallback(() => {
    if (audio.current) { audio.current.dataset.stopped = "1"; audio.current.pause(); audio.current = null; }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const clearCache = useCallback(() => {
    for (const p of cache.current.values()) void p.then((u) => u && URL.revokeObjectURL(u));
    cache.current.clear();
  }, []);

  const playFrom = useCallback(async (n: Narration, start: number, id: number) => {
    for (let i = start; i < n.claims.length; i++) {
      if (run.current !== id) return;
      setIndex(i);
      const url = await fetchAudio(n, i);
      void fetchAudio(n, i + 1); // prefetch
      if (run.current !== id) return;
      if (url) {
        setVoice("elevenlabs");
        await playUrl(url, (a) => { audio.current = a; });
      } else {
        setVoice("browser");
        await speakBrowser(n.claims[i].text, ctx.current.locale, rate.current);
      }
      if (run.current !== id) return;
      await new Promise((r) => setTimeout(r, 260)); // breath between claims
    }
    if (run.current === id) { setState("done"); setIndex(-1); }
  }, [fetchAudio]);

  const stop = useCallback(() => {
    run.current++;
    halt(); clearCache();
    setIndex(-1); setNarration(null); setState("idle");
  }, [halt, clearCache]);

  /** Fetch the verified narration for (disease, persona, locale); reuses the loaded one when it matches. */
  const loaded = useRef<{ key: string; n: Narration } | null>(null);
  const fetchNarration = useCallback(async (disease: string, persona: PersonaId, locale: Locale): Promise<Narration> => {
    const key = `${disease}|${persona}|${locale}|${simple.current ? 1 : 0}`;
    if (loaded.current?.key === key) return loaded.current.n;
    const r = await fetch("/api/narrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ disease, persona, locale, simple: simple.current }) });
    if (!r.ok) throw new Error(String(r.status));
    const n = (await r.json()) as Narration;
    loaded.current = { key, n };
    return n;
  }, []);

  const start = useCallback(async (disease: string, persona: PersonaId, locale: Locale) => {
    stop();
    const id = ++run.current;
    ctx.current = { persona, locale };
    setState("loading");
    try {
      const n = await fetchNarration(disease, persona, locale);
      if (run.current !== id) return;
      setNarration(n); setState("playing");
      await playFrom(n, 0, id);
    } catch { if (run.current === id) setState("error"); }
  }, [playFrom, stop, fetchNarration]);

  /** Load the narration text WITHOUT playing (Transcript tab: written sentences + sources, no audio). */
  const prepare = useCallback(async (disease: string, persona: PersonaId, locale: Locale) => {
    if (state === "playing" || state === "paused" || state === "loading") return;
    const id = ++run.current;
    ctx.current = { persona, locale };
    setState("loading");
    try {
      const n = await fetchNarration(disease, persona, locale);
      if (run.current !== id) return;
      setNarration(n); setIndex(-1); setState("ready");
    } catch { if (run.current === id) setState("error"); }
  }, [state, fetchNarration]);

  /** Highlight claim i on the map without any audio (stops playback if any). */
  const select = useCallback((i: number) => {
    if (!narration || i < 0 || i >= narration.claims.length) return;
    run.current++; halt();
    setIndex(i); setState("ready");
  }, [narration, halt]);

  /** Play the already-loaded narration from claim i (Talk tab). */
  const playLoaded = useCallback((i = 0) => {
    if (!narration) return;
    run.current++; halt();
    const id = run.current; setState("playing");
    void playFrom(narration, Math.max(0, i), id);
  }, [narration, playFrom, halt]);

  const pause = useCallback(() => {
    audio.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
    setState("paused");
  }, []);
  const resume = useCallback(() => {
    if (audio.current) void audio.current.play();
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
    setState("playing");
  }, []);

  /** Jump to a claim (transcript click, ←/→). */
  const jump = useCallback((i: number) => {
    if (!narration || i < 0 || i >= narration.claims.length) return;
    run.current++; halt();
    const id = run.current; setState("playing");
    void playFrom(narration, i, id);
  }, [narration, playFrom, halt]);
  const next = useCallback(() => jump(index + 1), [jump, index]);
  const prev = useCallback(() => jump(Math.max(0, index - 1)), [jump, index]);

  useEffect(() => () => { run.current++; halt(); }, [halt]);
  // A live agent call takes the floor: stop narrating.
  useEffect(() => {
    window.addEventListener(VOICE_LIVE_EVENT, stop);
    return () => window.removeEventListener(VOICE_LIVE_EVENT, stop);
  }, [stop]);

  const current = narration && index >= 0 ? narration.claims[index] : null;
  return { state, narration, index, current, voice, start, stop, pause, resume, jump, next, prev, prepare, select, playLoaded };
}
