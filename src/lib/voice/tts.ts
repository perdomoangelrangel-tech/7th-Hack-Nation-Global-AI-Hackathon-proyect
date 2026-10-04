/**
 * Server-only ElevenLabs text-to-speech with an in-memory cache keyed by a hash of
 * (voice, model, settings, text). OWNER: voice lane. Never import from a client component.
 *
 * Caching: the same verified sentence is spoken many times (every visitor hears the same narration),
 * so a warm serverless instance answers repeats without calling ElevenLabs. LRU, bounded by bytes.
 */
import { createHash } from "node:crypto";
import type { PersonaId } from "../agents/profiles";
import { TTS_MODEL, resolveVoice, settingsFor, type VoiceSettings } from "./voices";

export const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const MAX_CACHE_BYTES = 40 * 1024 * 1024;

export interface SpeakRequest { text: string; persona: PersonaId; voiceId?: string | null; rate?: number }
export interface SpeakPlan { voiceId: string; model: string; settings: VoiceSettings; text: string; key: string }

export function apiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

/** Normalize text so trivially different strings share a cache entry and nothing odd is spoken. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[*_`#>]/g, "").trim();
}

export function plan(req: SpeakRequest): SpeakPlan {
  const voice = resolveVoice(req.persona, req.voiceId);
  const settings = settingsFor(req.persona, req.rate ?? 1);
  const text = cleanText(req.text);
  const key = createHash("sha256").update(JSON.stringify([voice.id, TTS_MODEL, settings, text])).digest("hex");
  return { voiceId: voice.id, model: TTS_MODEL, settings, text, key };
}

// ---- LRU byte cache (Map keeps insertion order; re-insert on hit = most recent) ----
const cache = new Map<string, Uint8Array>();
let cacheBytes = 0;

export function cacheGet(key: string): Uint8Array | undefined {
  const v = cache.get(key);
  if (v) { cache.delete(key); cache.set(key, v); }
  return v;
}

export function cachePut(key: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CACHE_BYTES / 4) return;
  const prev = cache.get(key);
  if (prev) { cacheBytes -= prev.byteLength; cache.delete(key); }
  cache.set(key, bytes); cacheBytes += bytes.byteLength;
  for (const [k, v] of cache) {
    if (cacheBytes <= MAX_CACHE_BYTES) break;
    cache.delete(k); cacheBytes -= v.byteLength;
  }
}

export function cacheClear() { cache.clear(); cacheBytes = 0; }
export function cacheStats() { return { entries: cache.size, bytes: cacheBytes }; }

/** Collect a stream into one buffer (used to fill the cache from a tee'd branch). */
export async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); size += value.byteLength;
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

/**
 * Call ElevenLabs streaming TTS. Returns the upstream Response (caller checks `ok`).
 * `fetchImpl` is injectable for tests.
 */
export function elevenTTS(p: SpeakPlan, key: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(`${ELEVEN_BASE}/text-to-speech/${p.voiceId}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: p.text,
      model_id: p.model,
      voice_settings: { ...p.settings, use_speaker_boost: true },
    }),
  });
}
