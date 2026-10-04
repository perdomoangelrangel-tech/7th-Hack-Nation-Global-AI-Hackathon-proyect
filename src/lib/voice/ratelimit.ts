/**
 * Per-IP sliding-window rate limit, in memory per server instance (prototype-grade, WAVE 7 §T2.1).
 * OWNER: voice lane (used by /api/speak). Never stores request content — only timestamps per IP key.
 */
export interface RateResult { ok: boolean; remaining: number; retryAfter: number }

export function createLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, number[]>();
  return function check(key: string, now = Date.now()): RateResult {
    const since = now - windowMs;
    const arr = (hits.get(key) ?? []).filter((t) => t > since);
    if (arr.length >= limit) {
      hits.set(key, arr);
      return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000)) };
    }
    arr.push(now);
    hits.delete(key); hits.set(key, arr); // keep most recent last
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
    return { ok: true, remaining: limit - arr.length, retryAfter: 0 };
  };
}

/** Client IP from the platform headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Remove control characters (keeps \t \n \r) from user-supplied text. */
export function stripControl(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
