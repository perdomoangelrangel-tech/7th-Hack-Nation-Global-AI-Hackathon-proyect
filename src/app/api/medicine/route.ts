/**
 * GET /api/medicine?id=treatment:CHEMBL…&persona=devon|maria|osei|priya&locale=en|es&simple=1
 * → { id, name, sentences:[{ text, evidence_ids[], kind }], evidence:[{ id, source, external_id, url, quote }], dropped, mode, model?, disclaimer }
 * 3–5 plain-language sentences from graph facts only (mechanism, approved indications, trial stages, sources).
 * No dosing, no efficacy numbers, no recommendations; the last sentence is always the fixed clinician line.
 * CORS for the Lovable app comes from src/proxy.ts (all /api/*).
 */
import { NextRequest, NextResponse } from "next/server";
import { atlas, loadAtlas } from "@/lib/atlas/store";
import { isPersonaId } from "@/lib/agents/profiles";
import { medicineSummary } from "@/lib/ai/medicine";
import { medicineExtras, resolveMedicine } from "@/lib/ai/medicine-extras";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id")?.trim().slice(0, 200) ?? "";
  if (!id) return NextResponse.json({ error: "id required (e.g. treatment:CHEMBL2106217)" }, { status: 400 });
  const persona = sp.get("persona");
  await loadAtlas();
  const { entity: t, bankName } = await resolveMedicine(atlas(), id); // bank ids can differ from the graph's ChEMBL record
  if (!t) return NextResponse.json({ error: bankName ? `${bankName} is in the medicines bank but not linked in the evidence graph yet` : "medicine not in the atlas", in_bank: !!bankName }, { status: 404 });
  const r = await medicineSummary(atlas(), {
    id: t.id, persona: isPersonaId(persona) ? persona : "maria", locale: sp.get("locale") === "es" ? "es" : "en",
    simple: sp.has("simple") ? sp.get("simple") === "1" || sp.get("simple") === "true" : undefined,
  }, await medicineExtras(t)); // label use, Rx, routes, EMA, papers (migration 0015) when present
  if (!r) return NextResponse.json({ error: "medicine not in the atlas" }, { status: 404 });
  return NextResponse.json(r, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
