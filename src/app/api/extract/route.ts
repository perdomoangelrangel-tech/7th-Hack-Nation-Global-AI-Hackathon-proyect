/**
 * POST /api/extract { pmid?: string, text?: string, title?: string, save?: boolean }
 * → { source:{pmid?,url?,title?}, entities:[{ mention, type, entity_id|null, canonical_id|null, label, match, confidence }],
 *     claims:[{ subject, relation, object, polarity, quote, confidence, entity_ids[], graphable }], dropped[], saved, save_note?, extraction_id?, mode, model? }
 * PMID → title + abstract from NCBI E-utilities. OpenAI-mode results with verified claims are persisted with the
 * `save_extraction` RPC (anon, security definer); the loader turns them into dotted "extracted" edges.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, readJson } from "@/lib/ai/guard";
import { z } from "zod";
import { atlas, loadAtlas } from "@/lib/atlas/store";
import { publicClient } from "@/lib/supabase/server";
import { extract, type Saver } from "@/lib/ai/extract";
import { fetchPaper, normalizePmid } from "@/lib/ai/pubmed";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  pmid: z.string().trim().max(20).optional(),
  text: z.string().trim().min(40).max(12_000).optional(),
  title: z.string().trim().max(500).optional(),
  save: z.boolean().optional(),
}).refine((b) => b.pmid || b.text, { message: "pmid or text is required" });

const supabaseSaver: Saver = async (pmid, model, payload) => {
  const { data, error } = await publicClient().rpc("save_extraction", { p_pmid: pmid, p_model: model, p_payload: payload });
  if (error) throw new Error(error.message);
  return String(data);
};

export async function POST(req: NextRequest) {
  await loadAtlas();
  const limited = rateLimit(req, "extract", 5); if (limited) return limited;
  const raw = await readJson(req); if (!raw.ok) return raw.res;
  const parsed = Body.safeParse(raw.body);
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const b = parsed.data;

  if (b.pmid) {
    if (!normalizePmid(b.pmid)) return NextResponse.json({ error: "pmid must look like 12345678 or PMID:12345678" }, { status: 400 });
    const paper = await fetchPaper(b.pmid).catch((e: Error) => e);
    if (paper instanceof Error) return NextResponse.json({ error: `PubMed unavailable: ${paper.message}` }, { status: 502 });
    if (!paper) return NextResponse.json({ error: "PubMed has no title/abstract for that PMID" }, { status: 404 });
    return NextResponse.json(await extract(atlas(), { paper, save: b.save }, supabaseSaver));
  }
  return NextResponse.json(await extract(atlas(), { text: b.text, title: b.title, save: b.save }));
}
