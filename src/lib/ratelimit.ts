/**
 * Límite simple por IP (ventana deslizante en memoria, por instancia). Protege la clave de OpenAI de abuso
 * en los endpoints públicos; las respuestas cacheadas por la CDN ni siquiera llegan aquí.
 */
import "server-only";
import type { NextRequest } from "next/server";

const hits = new Map<string, number[]>();

export function limited(req: NextRequest, bucket: string, max: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
