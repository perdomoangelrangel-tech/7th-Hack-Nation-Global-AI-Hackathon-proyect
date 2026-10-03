/**
 * Handler behind POST /api/speak, kept out of the route file so it can be unit-tested.
 * Contract (WORKFLOW.md §3.2): { text, persona, locale } → audio/mpeg; 503 → client falls back to browser speech.
 * Extra optional fields (voice lane): voiceId (must be one of the persona's options), rate (prefs.voiceRate).
 * The UI only sends text that already passed the deterministic verifier (narration claims / verified answers).
 */
import { z } from "zod";
import { apiKey, cacheGet, cachePut, collect, elevenTTS, plan } from "./tts";

export const SpeakBody = z.object({
  text: z.string().min(1).max(1500),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
  voiceId: z.string().max(64).optional(),
  rate: z.number().min(0.8).max(1.2).optional(),
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const audio = (body: BodyInit, key: string, hit: boolean) =>
  new Response(body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "public, max-age=86400, immutable", // same hash → same audio
      "x-voice-provider": "elevenlabs",
      "x-voice-cache": hit ? "hit" : "miss",
      etag: `"${key.slice(0, 32)}"`,
    },
  });

export async function handleSpeak(raw: unknown, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const parsed = SpeakBody.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const key = apiKey();
  if (!key) return json({ error: "ELEVENLABS_API_KEY not set; use browser speech", fallback: "browser" }, 503);

  const p = plan({ text: parsed.data.text, persona: parsed.data.persona, voiceId: parsed.data.voiceId, rate: parsed.data.rate });
  if (!p.text) return json({ error: "empty text" }, 400);

  const cached = cacheGet(p.key);
  if (cached) return audio(cached.slice(), p.key, true);

  let upstream: Response;
  try {
    upstream = await elevenTTS(p, key, fetchImpl);
  } catch (e) {
    console.error("[speak] network", (e as Error).message);
    return json({ error: "tts unreachable", fallback: "browser" }, 502);
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("[speak] elevenlabs", upstream.status, detail.slice(0, 300));
    // 401/quota → tell the client to use browser speech for the rest of the session.
    return json({ error: `elevenlabs ${upstream.status}`, fallback: "browser" }, upstream.status === 401 || upstream.status === 429 ? 503 : 502);
  }

  // Stream to the client while a tee'd branch fills the cache.
  const [toClient, toCache] = upstream.body.tee();
  void collect(toCache).then((bytes) => cachePut(p.key, bytes)).catch(() => {});
  return audio(toClient, p.key, false);
}
