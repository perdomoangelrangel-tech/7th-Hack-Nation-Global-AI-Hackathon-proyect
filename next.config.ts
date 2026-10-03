import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets parallel agents/builds use separate output dirs (NEXT_DIST_DIR=.next-landing, …). Vercel uses the default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
};

export default nextConfig;
