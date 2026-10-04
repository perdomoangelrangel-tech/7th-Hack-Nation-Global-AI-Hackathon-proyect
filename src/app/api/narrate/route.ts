/**
 * POST /api/narrate { disease, persona: "maria"|"devon"|"priya"|"osei", locale?: "en"|"es", simple? }
 * Verified claims, each with evidence_ids + evidence and the nodes/edges the UI lights while the voice reads it.
 * With OPENAI_API_KEY the model drafts (mode "openai"); without it, a deterministic template (mode "deterministic").
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, readJson } from "@/lib/ai/guard";
import { z } from "zod";
import { narrate } from "@/lib/atlas/narrate";
import { loadAtlas } from "@/lib/atlas/store";

export const runtime = "nodejs";

const Body = z.object({
  disease: z.string().min(3).max(200),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
  simple: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await loadAtlas();
  const limited = rateLimit(req, "narrate", 30); if (limited) return limited;
  const raw = await readJson(req); if (!raw.ok) return raw.res;
  const parsed = Body.safeParse(raw.body);
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const n = await narrate(parsed.data.disease, parsed.data.persona, parsed.data.locale, { simple: parsed.data.simple });
  if (!n) return NextResponse.json({ error: "disease not found" }, { status: 404 });
  return NextResponse.json(n);
}
