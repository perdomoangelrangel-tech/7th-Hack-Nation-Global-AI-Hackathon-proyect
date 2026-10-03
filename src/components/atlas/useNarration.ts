"use client";
/**
 * Reproduce la narración frase por frase y expone la frase actual, para que el grafo ilumine sus nodos.
 * Voz: OpenAI (/api/speak) con precarga de la siguiente frase; si no hay clave (503), voz del navegador.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Narration } from "@/lib/atlas/narrate";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export type NarrationState = "idle" | "loading" | "playing" | "paused" | "done" | "error";

export function useNarration() {
  const [state, setState] = useState<NarrationState>("idle");
  const [narration, setNarration] = useState<Narration | null>(null);
  const [index, setIndex] = useState(-1);
  const [voice, setVoice] = useState<"openai" | "browser" | null>(null);
  const run = useRef(0);                                   // invalida reproducciones anteriores
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Promise<string | null>>());
  const ctx = useRef<{ persona: PersonaId; locale: Locale; useBrowser: boolean }>({ persona: "maria", locale: "en", useBrowser: false });

  const fetchAudio = useCallback((n: Narration, i: number): Promise<string | null> => {
    if (ctx.current.useBrowser || i >= n.claims.length) return Promise.resolve(null);
    if (!cache.current.has(i)) {
      cache.current.set(i, fetch("/api/speak", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: n.claims[i].text, persona: ctx.current.persona, locale: ctx.current.locale }),
      }).then(async (r) => {
        if (r.status === 503) { ctx.current.useBrowser = true; return null; }
        if (!r.ok) return null;
        return URL.createObjectURL(await r.blob());
      }).catch(() => null));
    }
    return cache.current.get(i)!;
  }, []);

  const speakBrowser = useCallback((text: string, locale: Locale) => new Promise<void>((resolve) => {
    // Temporizador de seguridad: en sistemas sin voces instaladas onend nunca llega y la narración se congelaría.
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, 2500 + 90 * text.length);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === "es" ? "es-ES" : "en-US";
    u.rate = 1.02;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(locale === "es" ? "es" : "en"));
    if (v) u.voice = v;
    u.onend = finish; u.onerror = finish;
    window.speechSynthesis.speak(u);
  }), []);

  const playFrom = useCallback(async (n: Narration, start: number, id: number) => {
    for (let i = start; i < n.claims.length; i++) {
      if (run.current !== id) return;
      setIndex(i);
      const url = await fetchAudio(n, i);
      void fetchAudio(n, i + 1); // precarga
      if (run.current !== id) return;
      if (url) {
        setVoice("openai");
        await new Promise<void>((resolve) => {
          const a = new Audio(url); audio.current = a;
          a.onended = () => resolve(); a.onerror = () => resolve();
          a.play().catch(() => resolve());
        });
      } else {
        setVoice("browser");
        await speakBrowser(n.claims[i].text, ctx.current.locale);
      }
      if (run.current !== id) return;
      await new Promise((r) => setTimeout(r, 260)); // respiro entre frases
    }
    if (run.current === id) { setState("done"); setIndex(-1); }
  }, [fetchAudio, speakBrowser]);

  const stop = useCallback(() => {
    run.current++;
    audio.current?.pause(); audio.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    for (const p of cache.current.values()) void p.then((u) => u && URL.revokeObjectURL(u));
    cache.current.clear();
    setIndex(-1); setState("idle");
  }, []);

  const start = useCallback(async (disease: string, persona: PersonaId, locale: Locale) => {
    stop();
    const id = ++run.current;
    ctx.current = { persona, locale, useBrowser: false };
    setState("loading"); setNarration(null);
    try {
      const r = await fetch("/api/narrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ disease, persona, locale }) });
      if (!r.ok) throw new Error(String(r.status));
      const n = (await r.json()) as Narration;
      if (run.current !== id) return;
      setNarration(n); setState("playing");
      await playFrom(n, 0, id);
    } catch { if (run.current === id) setState("error"); }
  }, [playFrom, stop]);

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
  /** Saltar a una frase (clic en la transcripción). */
  const jump = useCallback((i: number) => {
    if (!narration) return;
    run.current++; audio.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const id = run.current; setState("playing");
    void playFrom(narration, i, id);
  }, [narration, playFrom]);

  useEffect(() => () => { run.current++; audio.current?.pause(); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const current = narration && index >= 0 ? narration.claims[index] : null;
  return { state, narration, index, current, voice, start, stop, pause, resume, jump };
}
