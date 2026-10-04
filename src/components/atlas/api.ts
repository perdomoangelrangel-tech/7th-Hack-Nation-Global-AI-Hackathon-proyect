/**
 * Every explorer fetch goes through `api(path)` so the same components run on Vercel (same origin, base "")
 * and in the Lovable program (base = the Vercel API origin, e.g. VITE_NEXMED_API_URL). Port: swap the env read below
 * for `import.meta.env.VITE_NEXMED_API_URL`, or call `setApiBase()` once at startup.
 */
let base = (process.env.NEXT_PUBLIC_NEXMED_API_URL ?? "").replace(/\/$/, "");

export function setApiBase(url: string) { base = url.replace(/\/$/, ""); }
export const api = (path: string) => `${base}${path}`;
