/**
 * Handler behind POST /api/speak, kept out of the route file so it can be unit-tested.
 * Contract (WORKFLOW.md §3.2): { text, persona, locale } → audio/mpeg; 503 → client falls back to browser speech.
 * Extra optional fields (voice lane): voiceId (must be one of the persona's options), rate (prefs.voiceRate).
 * The UI only sends text that already passed the deterministic verifier (narration claims / verified answers).
 */
import { z } from "zod";
import { apiKey, cacheGet, cachePut, collect, elevenTTS, plan } from "./tts";
import { clientIp, createLimiter, stripControl } from "./ratelimit";

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
    void upstream.body?.cancel().catch(() => {});
    console.error("[speak] elevenlabs status", upstream.status); // never log the text or the upstream body
    // 401/quota → tell the client to use browser speech for the rest of the session.
    return json({ error: `elevenlabs ${upstream.status}`, fallback: "browser" }, upstream.status === 401 || upstream.status === 429 ? 503 : 502);
  }

  // Stream to the client while a tee'd branch fills the cache.
  const [toClient, toCache] = upstream.body.tee();
  void collect(toCache).then((bytes) => cachePut(p.key, bytes)).catch(() => {});
  return audio(toClient, p.key, false);
}

// ───────── Request guards (WAVE 7): rate limit, JSON only, size cap, control chars ─────────
export const SPEAK_LIMIT_PER_MIN = 20;
export const MAX_BODY_BYTES = 32 * 1024;
const limiter = createLimiter(SPEAK_LIMIT_PER_MIN, 60_000);

export async function speakRequest(req: Request, fetchImpl: typeof fetch = fetch, check = limiter): Promise<Response> {
  const rl = check(clientIp(req.headers));
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests — try again shortly.", fallback: "browser" }), {
      status: 429, headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return json({ error: "JSON body required" }, 415);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid JSON" }, 400); }
  if (body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string") {
    (body as { text: string }).text = stripControl((body as { text: string }).text);
  }
  return handleSpeak(body, fetchImpl);
}
