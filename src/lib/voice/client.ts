"use client";
/**
 * Client-side speech: ElevenLabs audio from /api/speak, browser speechSynthesis only as fallback.
 * OWNER: voice lane. Other lanes may call `speakVerified()` to read a verified answer aloud.
 */
import type { PersonaId } from "../agents/profiles";
import type { Locale } from "../i18n";
import { getVoicePrefs } from "./prefs";

export type VoiceProvider = "elevenlabs" | "browser";

/** Once the server says there is no key (503), stop asking for the rest of the session. */
let serverVoiceDown = false;
export const elevenAvailable = () => !serverVoiceDown;

export interface FetchSpeechOpts { persona: PersonaId; locale: Locale; rate?: number; voiceId?: string; signal?: AbortSignal }

/** Returns an object URL for ElevenLabs mp3, or null when the caller must use browser speech. */
export async function fetchSpeech(text: string, o: FetchSpeechOpts): Promise<string | null> {
  if (serverVoiceDown) return null;
  try {
    const r = await fetch("/api/speak", {
      method: "POST", headers: { "content-type": "application/json" }, signal: o.signal,
      body: JSON.stringify({ text, persona: o.persona, locale: o.locale, rate: o.rate, voiceId: o.voiceId ?? getVoicePrefs().voiceByPersona[o.persona] }),
    });
    if (r.status === 503) { serverVoiceDown = true; return null; }
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  } catch { return null; }
}

/** Play an object URL; resolves when it ends, fails or is replaced. Returns the element for pause/resume. */
export function playUrl(url: string, onElement?: (a: HTMLAudioElement) => void): Promise<void> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    onElement?.(a);
    a.onended = () => resolve(); a.onerror = () => resolve(); a.onpause = () => { if (a.dataset.stopped) resolve(); };
    a.play().catch(() => resolve());
  });
}

/** Browser speech fallback with a safety timer (systems without voices never fire onend). */
export function speakBrowser(text: string, locale: Locale, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, (2500 + 90 * text.length) / rate);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === "es" ? "es-ES" : "en-US";
    u.rate = rate;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(locale));
    if (v) u.voice = v;
    u.onend = finish; u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

let currentAudio: HTMLAudioElement | null = null;

/** Stop whatever `speakVerified` is playing. */
export function stopSpeaking() {
  if (currentAudio) { currentAudio.dataset.stopped = "1"; currentAudio.pause(); currentAudio = null; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Speak one verified text with the persona's ElevenLabs voice (browser fallback).
 * Call only from a user gesture or after one (no autoplay before interaction).
 */
export async function speakVerified(text: string, o: FetchSpeechOpts): Promise<VoiceProvider> {
  stopSpeaking();
  const url = await fetchSpeech(text, o);
  if (url) {
    await playUrl(url, (a) => { currentAudio = a; });
    URL.revokeObjectURL(url);
    return "elevenlabs";
  }
  await speakBrowser(text, o.locale, o.rate ?? 1);
  return "browser";
}
