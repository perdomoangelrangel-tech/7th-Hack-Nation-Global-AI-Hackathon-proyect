/**
 * Voice map: one ElevenLabs voice per Nedamex mode, plus alternates for personalization.
 * OWNER: voice lane. Shared by /api/speak (server) and the voice UI (client) — no secrets here.
 *
 * Voice ids come from the workspace's ElevenLabs library (listed via the ElevenLabs MCP on 2026-10-03).
 * Only **premade** voices are used: they work with any API key in the workspace without first adding
 * a community voice to "My Voices", so a fresh key on Vercel never 404s on a voice id.
 *
 * Models (why two):
 * - Narration + "read answer aloud" → `eleven_multilingual_v2`: highest quality and natural prosody in
 *   EN and ES. Latency is hidden because useNarration prefetches the next claim while one plays, and
 *   /api/speak caches every sentence by hash.
 * - Live conversational agents → `eleven_flash_v2` (English agents must use turbo/flash v2): turn-taking needs low latency more than
 *   studio polish. Configured on the ElevenLabs agents themselves (see AGENT_TTS_MODEL).
 */
import type { PersonaId } from "../agents/profiles";

export const TTS_MODEL = "eleven_multilingual_v2";
export const AGENT_TTS_MODEL = "eleven_flash_v2"; // ElevenLabs requires turbo/flash v2 for English agents

export interface VoiceSettings {
  stability: number;          // 0..1 — higher = calmer, less variation
  similarity_boost: number;   // 0..1
  style: number;              // 0..1 — expressiveness (costs latency; keep low)
  speed: number;              // 0.7..1.2 base pace, multiplied by prefs.voiceRate
}

export interface VoiceOption { id: string; name: string; note: string }

export interface PersonaVoice {
  primary: VoiceOption;
  alternates: VoiceOption[];
  settings: VoiceSettings;
}

/** Character brief from the lane spec: warm/slow · steady/strategic · measured/precise · crisp/briefing. */
export const VOICES: Record<PersonaId, PersonaVoice> = {
  devon: {
    primary: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", note: "Warm, reassuring, mature" },
    alternates: [
      { id: "SAz9YHcvj6GT2YYXdXww", name: "River", note: "Relaxed, calm, neutral" },
      { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", note: "Gentle alto, knowledgeable" },
    ],
    settings: { stability: 0.7, similarity_boost: 0.75, style: 0.1, speed: 0.92 },
  },
  maria: {
    primary: { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", note: "Steady, confident alto" },
    alternates: [
      { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", note: "Bright, warm, professional" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", note: "Warm, reassuring" },
    ],
    settings: { stability: 0.6, similarity_boost: 0.75, style: 0.15, speed: 1 },
  },
  osei: {
    primary: { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", note: "Measured, formal, steady" },
    alternates: [
      { id: "nPczCjzI2devNBz1zQrb", name: "Brian", note: "Deep, even narrator" },
      { id: "SAz9YHcvj6GT2YYXdXww", name: "River", note: "Neutral, informative" },
    ],
    settings: { stability: 0.65, similarity_boost: 0.8, style: 0.05, speed: 1 },
  },
  priya: {
    primary: { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", note: "Crisp diction, briefing pace" },
    alternates: [
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", note: "Clear, engaging, British" },
      { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", note: "Formal broadcaster" },
    ],
    settings: { stability: 0.55, similarity_boost: 0.8, style: 0.1, speed: 1.06 },
  },
};

export const PERSONA_IDS = Object.keys(VOICES) as PersonaId[];

/** All voices offered for a persona (primary first). */
export function voiceOptions(persona: PersonaId): VoiceOption[] {
  const v = VOICES[persona];
  return [v.primary, ...v.alternates];
}

/** Resolve the voice to use: a requested id is honoured only if it is one of this persona's options. */
export function resolveVoice(persona: PersonaId, requested?: string | null): VoiceOption {
  return voiceOptions(persona).find((o) => o.id === requested) ?? VOICES[persona].primary;
}

/** ElevenLabs accepts speed 0.7..1.2. `rate` is the user's prefs.voiceRate (0.8..1.2). */
export function settingsFor(persona: PersonaId, rate = 1): VoiceSettings {
  const s = VOICES[persona].settings;
  const speed = Math.min(1.2, Math.max(0.7, Math.round(s.speed * rate * 100) / 100));
  return { ...s, speed };
}
