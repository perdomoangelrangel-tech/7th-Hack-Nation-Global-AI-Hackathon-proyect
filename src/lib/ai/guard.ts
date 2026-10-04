/**
 * Abuse guards for public API routes (prototype: in-memory per instance).
 *  - rateLimit(): per-IP sliding window → 429 with Retry-After.
 *  - readJson(): JSON only, body ≤ 32 kB, control characters stripped from every string.
 * Never logs request text; only the route name and the limit hit.
 * Reusable by other lanes: `import { rateLimit, readJson } from "@/lib/ai/guard"`.
 */
import { NextResponse, type NextRequest } from "next/server";

export const MAX_BODY_BYTES = 32 * 1024;

const hits = new Map<string, number[]>();
let lastSweep = 0;

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Returns a 429 response when `ip` exceeded `limit` calls to `route` in the last `windowMs`; otherwise null. */
export function rateLimit(req: NextRequest | Request, route: string, limit: number, windowMs = 60_000): NextResponse | null {
  const now = Date.now();
  if (now - lastSweep > windowMs) { // keep the map small
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    lastSweep = now;
  }
  const key = `${route}|${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retry = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    hits.set(key, recent);
    console.warn(`[guard] 429 ${route} (limit ${limit}/${windowMs / 1000}s)`);
    return NextResponse.json({ error: "too many requests", retry_after_seconds: retry }, { status: 429, headers: { "retry-after": String(retry) } });
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}

/** Control characters (except tab/newline) removed, recursively, from every string in a parsed body. */
export function stripControl<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "") as T;
  if (Array.isArray(v)) return v.map(stripControl) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripControl(x)])) as T;
  return v;
}

/** Parse a JSON body safely: 415 if not JSON, 413 if > 32 kB, 400 if malformed. */
export async function readJson(req: NextRequest | Request): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const type = req.headers.get("content-type") ?? "";
  if (!/application\/json/i.test(type)) return { ok: false, res: NextResponse.json({ error: "content-type must be application/json" }, { status: 415 }) };
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { ok: false, res: NextResponse.json({ error: "body too large (max 32 kB)" }, { status: 413 }) };
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { ok: false, res: NextResponse.json({ error: "body too large (max 32 kB)" }, { status: 413 }) };
  try { return { ok: true, body: stripControl(JSON.parse(text)) }; }
  catch { return { ok: false, res: NextResponse.json({ error: "invalid JSON" }, { status: 400 }) }; }
}
