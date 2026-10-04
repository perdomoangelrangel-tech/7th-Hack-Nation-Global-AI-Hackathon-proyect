/**
 * Request guards for the action lane's write endpoints (WAVE 7 security):
 *   - per-IP sliding-window rate limit → 429 + Retry-After (in-memory per instance: fine for the prototype)
 *   - JSON only, body ≤ 32 kB, control characters stripped from every string
 *   - honeypot: a hidden form field humans never fill; if it is filled the request is rejected
 * Never logs request text — only the route key and counts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { HONEYPOT_FIELD } from "./guard-shared";

export { HONEYPOT_FIELD };

export const MAX_BODY_BYTES = 32 * 1024;

const hits = new Map<string, number[]>();
let sweepAt = 0;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
}

/** Sliding window: at most `limit` requests per `windowMs` per IP and route key. */
export function rateLimit(req: Request, key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const id = `${key}|${clientIp(req)}`;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  hits.set(id, recent);
  if (now - sweepAt > windowMs) { // keep memory bounded
    sweepAt = now;
    for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true };
}

export function tooMany(retryAfter: number) {
  return NextResponse.json({ ok: false, error: "too many requests — please wait a moment and try again" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/** Remove control characters (keeps \n and \t, which drafts use) from every string, recursively. */
export function stripControl<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") as T;
  if (Array.isArray(v)) return v.map(stripControl) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripControl(x)])) as T;
  return v;
}

/** JSON-only body reader with a hard size cap. Returns the parsed, cleaned value or a ready error response. */
export async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return { ok: false, res: NextResponse.json({ ok: false, error: "send JSON (content-type: application/json)" }, { status: 415 }) };
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { ok: false, res: NextResponse.json({ ok: false, error: "request too large" }, { status: 413 }) };
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { ok: false, res: NextResponse.json({ ok: false, error: "request too large" }, { status: 413 }) };
  try { return { ok: true, body: stripControl(JSON.parse(text)) }; }
  catch { return { ok: false, res: NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }; }
}

/** True when the hidden honeypot field came back filled (a bot). */
export function honeypotTripped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const v = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof v === "string" ? v.trim().length > 0 : v != null && v !== false;
}
