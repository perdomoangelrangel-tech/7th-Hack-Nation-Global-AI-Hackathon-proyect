"use client";
/**
 * 3D first, 2D fallback. Automatic 2D when: prefers-reduced-motion, usePrefs().reduceMotion, no WebGL,
 * small screen (< 768 px) or a low-power device. Patient and Family modes start in 2D (UX_WAVE4 §2 S2); Researcher and
 * Pharma start in 3D. The visible "3D / 2D" toggle overrides the automatic choice
 * (persisted per viewer; storage is a convenience and may be unavailable).
 */
import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "@/lib/prefs";

export type GraphMode = "3d" | "2d";
const KEY = "nexmed.graphMode.v1";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Why 2D was chosen automatically (shown next to the toggle), or null when 3D is fine. */
export type FallbackReason = "reduced-motion" | "no-webgl" | "small-screen" | "low-power" | null;

function autoReason(prefReduce: boolean): FallbackReason {
  if (typeof window === "undefined") return null;
  if (prefReduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  if (!hasWebGL()) return "no-webgl";
  if (window.innerWidth < 768) return "small-screen";
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 2 || mem <= 2) return "low-power";
  return null;
}

export function useGraphMode(persona?: string) {
  const { prefs } = usePrefs();
  const [choice, setChoice] = useState<GraphMode | null>(null);
  const [reason, setReason] = useState<FallbackReason>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred: window/matchMedia only exist after mount (server renders the placeholder).
    const id = requestAnimationFrame(() => {
      setReason(autoReason(prefs.reduceMotion));
      try { const v = localStorage.getItem(KEY); if (v === "3d" || v === "2d") setChoice(v); } catch { /* storage unavailable */ }
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [prefs.reduceMotion]);

  const webgl = reason !== "no-webgl";
  const personaDefault: GraphMode = persona === "devon" || persona === "maria" ? "2d" : "3d";
  const mode: GraphMode = !webgl ? "2d" : choice ?? (reason ? "2d" : personaDefault);
  const setMode = useCallback((m: GraphMode) => {
    setChoice(m);
    try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ }
  }, []);
  return { mode, setMode, reason, ready, webgl };
}
