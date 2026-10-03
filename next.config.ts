import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El grafo se lee con fs en el servidor: hay que incluirlo explícitamente en el trace del despliegue.
  outputFileTracingIncludes: {
    "/*": ["./data/atlas.json"],
    "/api/**": ["./data/atlas.json"],
  },
};

export default nextConfig;
