"use client";
/**
 * Voice-only preferences (voice choice per mode, read every answer aloud). OWNER: voice lane.
 * Shared a11y prefs (voiceRate, captions, autoRead, reduceMotion) stay in `usePrefs()` (explorer lane);
 * these live here so the voice lane never edits another lane's contract. localStorage, try/catch.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { PersonaId } from "../agents/profiles";

export interface VoicePrefs {
  voiceByPersona: Partial<Record<PersonaId, string>>;
  readAnswers: boolean;
}

const KEY = "nexmed.voice.v1";
const DEFAULTS: VoicePrefs = { voiceByPersona: {}, readAnswers: false };
const listeners = new Set<() => void>();
let current: VoicePrefs | null = null;

function load(): VoicePrefs {
  if (current) return current;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    current = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { current = DEFAULTS; }
  return current!;
}

export function getVoicePrefs(): VoicePrefs { return load(); }

export function setVoicePrefs(patch: Partial<VoicePrefs>) {
  current = { ...load(), ...patch };
  try { window.localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useVoicePrefs() {
  const prefs = useSyncExternalStore(subscribe, load, () => DEFAULTS);
  const setVoice = useCallback((persona: PersonaId, id: string) => setVoicePrefs({ voiceByPersona: { ...load().voiceByPersona, [persona]: id } }), []);
  return { prefs, setVoicePrefs, setVoice };
}
