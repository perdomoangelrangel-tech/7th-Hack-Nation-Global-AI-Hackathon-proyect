"use client";
/**
 * Accessibility + voice preferences shared by every lane. OWNER: explorer lane (UI for editing them).
 * Voice lane reads voiceRate/autoRead/voiceStyle; AI lane receives `simpleLanguage` from the client.
 * Persisted per viewer in localStorage (wrapped in try/catch).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Prefs {
  textScale: 1 | 1.15 | 1.3;      // root font scaling
  highContrast: boolean;
  reduceMotion: boolean;          // on top of prefers-reduced-motion
  simpleLanguage: boolean;        // plain-language answers (reading level ~grade 6)
  autoRead: boolean;              // speak answers/narration automatically
  voiceRate: number;              // 0.8 .. 1.2
  captions: boolean;              // always show transcript while speaking
}
export const DEFAULT_PREFS: Prefs = { textScale: 1, highContrast: false, reduceMotion: false, simpleLanguage: false, autoRead: true, voiceRate: 1, captions: true };

const Ctx = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, setPrefs: () => {} });
const KEY = "nexmed.prefs.v1";

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, set] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) set({ ...DEFAULT_PREFS, ...JSON.parse(raw) }); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
    const root = document.documentElement;
    root.style.fontSize = `${prefs.textScale * 100}%`;
    root.dataset.contrast = prefs.highContrast ? "high" : "normal";
    root.dataset.motion = prefs.reduceMotion ? "reduce" : "auto";
  }, [prefs]);
  const value = useMemo(() => ({ prefs, setPrefs: (p: Partial<Prefs>) => set((s) => ({ ...s, ...p })) }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
