/**
 * Embed bridge protocol (WAVE 6 T8) — pure helpers, unit-tested in bridge.test.ts.
 * The engine (/atlas, framed by the platform shell) talks to its parent with window.postMessage:
 *   engine → parent  { type: "nedamex:ready", route }            once, after mount
 *                    { type: "nedamex:height", height }          on every size change (px, integer)
 *                    { type: "nedamex:route", route }            on load and whenever the URL state changes
 *   parent → engine  { type: "nedamex:navigate", p?, d?, mode?, l? }   validated; only from an allowed origin
 * route = { p, d, mode, step, e, l, path } (null when absent). Messages go only to an allowed parent origin.
 */
import type { StartMode } from "./memory";

export const BRIDGE = { ready: "nedamex:ready", height: "nedamex:height", route: "nedamex:route", navigate: "nedamex:navigate" } as const;

export interface BridgeRoute { p: string | null; d: string | null; mode: string | null; step: string | null; e: string | null; l: string | null; path: string }

export function routeFromUrl(href: string): BridgeRoute {
  const u = new URL(href);
  const g = (k: string) => u.searchParams.get(k);
  return { p: g("p"), d: g("d"), mode: g("mode"), step: g("step"), e: g("e"), l: g("l"), path: u.pathname };
}

export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { const o = new URL(url).origin; return o === "null" ? null : o; } catch { return null; }
}

/** The parent we may talk to: the referrer's origin when it is allowed, else the first allowed (the platform app). */
export function pickTargetOrigin(referrer: string, allowed: string[]): string | null {
  const ref = originOf(referrer);
  if (ref && allowed.includes(ref)) return ref;
  return allowed[0] ?? null;
}

const PERSONA_IDS = new Set(["devon", "maria", "osei", "priya"]);
const MODES = new Set<StartMode>(["challenge", "free"]);
const DISEASE_ID = /^disease:[A-Za-z0-9:._-]{1,64}$/;

export interface NavigateRequest { p?: string; d?: string; mode?: StartMode; l?: "en" | "es" }

/** Validates a parent's navigate request; anything unexpected is dropped, never interpolated. */
export function parseNavigate(data: unknown): NavigateRequest | null {
  if (!data || typeof data !== "object" || (data as { type?: unknown }).type !== BRIDGE.navigate) return null;
  const x = data as Record<string, unknown>;
  const out: NavigateRequest = {};
  if (typeof x.p === "string" && PERSONA_IDS.has(x.p)) out.p = x.p;
  if (typeof x.d === "string" && DISEASE_ID.test(x.d)) out.d = x.d;
  if (typeof x.mode === "string" && MODES.has(x.mode as StartMode)) out.mode = x.mode as StartMode;
  if (x.l === "en" || x.l === "es") out.l = x.l;
  return Object.keys(out).length ? out : null;
}

/** /atlas URL for a navigate request, keeping the current params it does not override (embed=1 stays). */
export function navigateHref(current: string, req: NavigateRequest): string {
  const u = new URL(current);
  for (const k of ["p", "d", "mode", "l"] as const) if (req[k]) u.searchParams.set(k, req[k]!);
  if (req.d) { u.searchParams.delete("e"); u.searchParams.delete("step"); }
  return `/atlas?${u.searchParams.toString()}`;
}
