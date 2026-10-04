// src/lib/sfx.ts — Nedamex UI sound effects (Kenney "Interface Sounds" + "RPG Audio", CC0 1.0).
// Subtle, user-toggleable (default ON at low volume), never autoplays: call playSfx() only inside
// a user gesture handler (click / keydown / submit) or right after a user-initiated async result.
"use client";

export type SfxName =
  | "tap" | "select" | "tick" | "open" | "close" | "toggle"
  | "success" | "start" | "error" | "message" | "send" | "step" | "page";

const BASE = (process.env.NEXT_PUBLIC_SFX_BASE ?? "/sfx").replace(/\/$/, "");
const KEY = "nedamex:sfx"; // "on" | "off"
const MASTER = 0.55;
const LEVEL: Record<SfxName, number> = {
  tap: 0.35, select: 0.4, tick: 0.18, open: 0.35, close: 0.3, toggle: 0.35,
  success: 0.45, start: 0.45, error: 0.35, message: 0.4, send: 0.35, step: 0.4, page: 0.35,
};

let ctx: AudioContext | null = null;
const buffers = new Map<SfxName, Promise<AudioBuffer | null>>();
let lastAt = 0;

export function sfxEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSfxEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage blocked: keep default */ }
  window.dispatchEvent(new CustomEvent("nedamex:sfx", { detail: on }));
}

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function load(name: SfxName): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    p = fetch(`${BASE}/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => audioCtx()?.decodeAudioData(b) ?? null)
      .catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

/** Warm the cache after the first interaction (optional). */
export function preloadSfx(names: SfxName[] = ["tap", "select", "open", "close", "message"]): void {
  if (!sfxEnabled()) return;
  names.forEach((n) => void load(n));
}

export function playSfx(name: SfxName): void {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  const now = performance.now();
  if (now - lastAt < 40) return; // no machine-gun clicks
  lastAt = now;
  const ac = audioCtx();
  const vol = MASTER * LEVEL[name];
  if (!ac) {
    try { const a = new Audio(`${BASE}/${name}.mp3`); a.volume = vol; void a.play(); } catch { /* ignore */ }
    return;
  }
  void load(name).then((buf) => {
    if (!buf) return;
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(ac.destination);
    src.start();
  });
}
