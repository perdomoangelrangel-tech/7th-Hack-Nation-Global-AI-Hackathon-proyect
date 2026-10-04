/**
 * POST /api/reconcile { names: string[], type? }
 * → { matches:[{ name, entity_id|null, canonical_id|null, label, type, method, confidence, matched_synonym, candidates[] }], mode, model? }
 * Deterministic tiers first (canonical id → exact → alias → normalized → fuzzy); the model only breaks
 * ambiguous ties among the candidates it is given and can never invent an id.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, readJson } from "@/lib/ai/guard";
import { z } from "zod";
import { atlas, loadAtlas } from "@/lib/atlas/store";
import { reconcile } from "@/lib/ai/reconcile";

export const runtime = "nodejs";

const Body = z.object({
  names: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  type: z.enum(["disease", "gene", "phenotype", "variant", "trial", "study", "treatment", "organization", "pathway", "investigator"]).optional(),
});

export async function POST(req: NextRequest) {
  await loadAtlas();
  const limited = rateLimit(req, "reconcile", 30); if (limited) return limited;
  const raw = await readJson(req); if (!raw.ok) return raw.res;
  const parsed = Body.safeParse(raw.body);
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  return NextResponse.json(await reconcile(atlas(), parsed.data.names, { type: parsed.data.type }));
}
