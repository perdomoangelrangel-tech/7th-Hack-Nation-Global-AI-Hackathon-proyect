/**
 * POST /api/explain { edgeIds: string[], persona, locale, simple?, question? }
 * → { sentences:[{ text, edge_ids[], evidence_ids[], kind }], dropped, mode:"openai"|"deterministic", model?, spoken, disclaimer, ... }
 * Plain-language explanation of a graph path for one persona. Every sentence is verified against the edges' evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { atlas, loadAtlas } from "@/lib/atlas/store";
import { explain } from "@/lib/ai/explain";

export const runtime = "nodejs";

const Body = z.object({
  edgeIds: z.array(z.string().min(1).max(200)).min(1).max(50),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
  simple: z.boolean().optional(),
  question: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  await loadAtlas();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  return NextResponse.json(await explain(atlas(), parsed.data));
}
