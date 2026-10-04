/**
 * Legacy entry point kept for existing imports (`/api/speak` uses `openai()` + `TTS_MODEL`).
 * New code uses `src/lib/ai/client.ts` (structured outputs, timeouts, retries, deterministic fallback).
 */
import "server-only";
import OpenAI from "openai";
import { MODEL } from "./ai/client";

export { structured, aiEnabled, MODEL, MODEL_FAST } from "./ai/client";

/** Default drafting model (OPENAI_MODEL, gpt-4o). */
export const TEXT_MODEL = MODEL();
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

let client: OpenAI | null | undefined;
/** Raw SDK client (audio / TTS). Null without OPENAI_API_KEY. */
export function openai(): OpenAI | null {
  if (client !== undefined) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  client = apiKey ? new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 }) : null;
  return client;
}
