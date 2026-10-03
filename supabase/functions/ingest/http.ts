// HTTP helpers: retries with backoff (429/5xx), timeouts, date normalisation.
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const today = () => new Date().toISOString().slice(0, 10);
export const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const UA = "NedamexAtlasIngest/1.0 (open-data rare disease evidence graph; Hack-Nation 2026)";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function fetchRetry(url: string, init: RequestInit = {}, retries = 3, timeoutMs = 30000): Promise<Response> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": UA, ...(init.headers as Record<string, string> ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      const body = await res.text().catch(() => "");
      if (res.status === 429 || res.status >= 500) {
        last = new HttpError(res.status, `${res.status} for ${url}: ${body.slice(0, 200)}`);
        await sleep(1000 * (i + 1));
        continue;
      }
      throw new HttpError(res.status, `${res.status} ${res.statusText} for ${url}: ${body.slice(0, 300)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status < 500 && e.status !== 429) throw e;
      last = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw last instanceof Error ? last : new Error(`gave up on ${url}`);
}

// deno-lint-ignore no-explicit-any
export async function getJSON<T = any>(url: string, init: RequestInit = {}, retries = 3): Promise<T> {
  const res = await fetchRetry(url, { ...init, headers: { accept: "application/json", ...(init.headers as Record<string, string> ?? {}) } }, retries);
  return (await res.json()) as T;
}

export async function getText(url: string, init: RequestInit = {}, retries = 3): Promise<string> {
  const res = await fetchRetry(url, init, retries);
  return await res.text();
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Any date-ish string -> YYYY-MM-DD (or undefined). "2023-05" -> "2023-05-01", "2024 Jan 15" -> "2024-01-15". */
export function isoDate(s?: string | null): string | undefined {
  if (!s) return undefined;
  let m = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/(\d{4})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[1]}-${MONTHS[m[2].toLowerCase()]}-${m[3].padStart(2, "0")}`;
  m = s.match(/(\d{4})\s+([A-Za-z]{3})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[1]}-${MONTHS[m[2].toLowerCase()]}-01`;
  m = s.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/\d{4}/);
  return m ? `${m[0]}-01-01` : undefined;
}

/** Depth-first search for the first value stored under `key` (APIs wrap payloads differently). */
// deno-lint-ignore no-explicit-any
export function findKey(obj: any, key: string, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 8) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const v of Object.values(obj)) {
    const hit = findKey(v, key, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export const asArray = <T>(x: T | T[] | null | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

export const trunc = (s: unknown, n: number) => (typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : undefined);
