/**
 * What Home remembers per viewer (UX_WAVE4 §4.7): the role, the last disease opened from Home and whether
 * the tour was seen. localStorage only, every access in try/catch — Home renders the same without it.
 */
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

const KEY = "nedamex.home.v1";

export interface HomeMemory { role?: PersonaId; disease?: string; tourSeen?: boolean }

export function readMemory(): HomeMemory {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as HomeMemory) : {}; } catch { return {}; }
}

export function writeMemory(patch: HomeMemory) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readMemory(), ...patch })); } catch { /* storage unavailable */ }
}

/** The one place Home builds atlas links: the URL is the state (UX_WAVE4 §4.1). */
export type StartMode = "challenge" | "free";

export function atlasHref({ p, d, c, mode, l }: { p: PersonaId; d?: string | null; c?: string; mode?: StartMode; l: Locale }) {
  const u = new URLSearchParams({ p });
  if (d) u.set("d", d);
  if (mode) u.set("mode", mode); // WAVE 6: challenge = Maria's guided route · free = explore (explorer honours it)
  if (c) u.set("c", c); // mechanism cluster picked in search (explorer may highlight it)
  u.set("l", l);
  return `/atlas?${u.toString()}`;
}
