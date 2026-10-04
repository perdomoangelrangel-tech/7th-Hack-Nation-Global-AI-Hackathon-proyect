import type { NextConfig } from "next";

// Security headers (WAVE 7). frame-ancestors lets the Lovable platform embed /atlas; no X-Frame-Options (it would block that).
const FRAME_ANCESTORS = "'self' https://nedamex.lovable.app https://*.lovable.app";
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Enforced: only who may frame us.
  { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS}; base-uri 'self'; object-src 'none'; form-action 'self'` },
  // Full policy in report-only first (no risk of breaking the demo); promote after a clean run.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data: https:",
      "connect-src 'self' https://zuqwmvshkhniqebtxlks.supabase.co wss://zuqwmvshkhniqebtxlks.supabase.co https://*.elevenlabs.io wss://*.elevenlabs.io https://api.elevenlabs.io wss://api.elevenlabs.io",
      "worker-src 'self' blob:",
      `frame-ancestors ${FRAME_ANCESTORS}`,
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // El grafo se lee con fs en el servidor: hay que incluirlo explícitamente en el trace del despliegue.
  outputFileTracingIncludes: {
    "/*": ["./data/atlas.json"],
    "/api/**": ["./data/atlas.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
