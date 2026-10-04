/** Pure helpers for <PersonaOrb> (agent switch cross-fade). OWNER: voice lane. */
import type { PersonaId } from "../agents/profiles";

export const PERSONA_ORDER: PersonaId[] = ["devon", "maria", "osei", "priya"];
export const FADE_MS = 350;

export interface OrbLayer { p: PersonaId; k: number }

/** Next layer stack when the shown agent changes: keep only the outgoing layer + the incoming one. */
export function nextLayers(layers: OrbLayer[], p: PersonaId): OrbLayer[] {
  const top = layers[layers.length - 1];
  if (top?.p === p) return layers;
  return [...(top ? [top] : []), { p, k: (top?.k ?? 0) + 1 }];
}

/** Agent shown at `tick` when cycling from `start` (loops forever). */
export function cycledPersona(start: PersonaId, tick: number): PersonaId {
  const i = PERSONA_ORDER.indexOf(start);
  return PERSONA_ORDER[(((i < 0 ? 0 : i) + tick) % PERSONA_ORDER.length + PERSONA_ORDER.length) % PERSONA_ORDER.length];
}
