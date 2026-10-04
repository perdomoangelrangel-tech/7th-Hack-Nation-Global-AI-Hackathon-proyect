// Cross-origin access to /api/* for the Lovable app (see src/proxy.ts).
// Allow-list only: Lovable hosts, local Vite dev servers, the published program URL
// (NEXT_PUBLIC_PROGRAM_URL) and any extra origins in CORS_EXTRA_ORIGINS (comma-separated).

const PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lovableproject\.com$/,
  /^http:\/\/localhost:(8080|5173)$/,
];

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!origin) return false;
  if (PATTERNS.some((re) => re.test(origin))) return true;
  const extra = [originOf(env.NEXT_PUBLIC_PROGRAM_URL), ...(env.CORS_EXTRA_ORIGINS ?? "").split(",").map((s) => originOf(s.trim()))];
  return extra.includes(origin);
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-atlas-key",
  "Access-Control-Max-Age": "86400",
} as const;
