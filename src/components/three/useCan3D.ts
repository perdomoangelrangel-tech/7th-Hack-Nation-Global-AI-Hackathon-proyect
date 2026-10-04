"use client";
/**
 * Decides whether an animated 3D element may render: WebGL available, no OS reduced-motion, no in-app
 * "reduce motion" pref (`usePrefs`), not a low-power / data-saver device. Everything else gets the static
 * poster or CSS fallback. Returns "pending" until mounted so SSR and first paint always show the fallback.
 */
import { useEffect, useState } from "react";
import { usePrefs } from "@/lib/prefs";

export type Can3D = "pending" | "3d" | "static";

let webglCache: boolean | null = null;
function hasWebGL() {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglCache = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

function lowPower() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4 || nav.connection?.saveData === true;
}

export function useCan3D(): Can3D {
  const { prefs } = usePrefs();
  const [env, setEnv] = useState<"pending" | "ok" | "no">("pending");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const check = () => setEnv(mq.matches || lowPower() || !hasWebGL() ? "no" : "ok");
    const id = requestAnimationFrame(check); // deferred: no synchronous setState inside the effect
    mq.addEventListener("change", check);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", check);
    };
  }, []);
  if (env === "pending") return "pending";
  return env === "ok" && !prefs.reduceMotion ? "3d" : "static";
}
