/**
 * Herramientas del agente. Una ruta, varias herramientas, todas de solo lectura.
 * GET /api/tools/disease?q=Dravet
 * GET /api/tools/trials?q=ORPHA:33069&country=Mexico
 * GET /api/tools/treatments?q=Rett
 * GET /api/tools/literature?q=Angelman
 * GET /api/tools/communities?q=CDKL5
 * GET /api/tools/gaps?q=CLN2
 * GET /api/tools/phenotype-match?hpo=HP:0001250,HP:0001263
 * ElevenLabs las llama como Server Tools con el header x-atlas-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { loadAtlas } from "@/lib/atlas/store";
import { diseaseProfile, trialsFor, treatmentsFor, literatureFor, communitiesFor, gapsFor, phenotypeMatch } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  await loadAtlas();
  const { tool } = await ctx.params;
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";

  try {
    switch (tool) {
      case "disease":       return reply(await diseaseProfile(q));
      case "trials":        return reply(await trialsFor(q, sp.get("country") ?? undefined));
      case "treatments":    return reply(await treatmentsFor(q));
      case "literature":    return reply(await literatureFor(q));
      case "communities":   return reply(await communitiesFor(q));
      case "gaps":          return reply(await gapsFor(q));
      case "phenotype-match": {
        const hpo = (sp.get("hpo") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        if (!hpo.length) return NextResponse.json({ error: "hpo required" }, { status: 400 });
        return reply(await phenotypeMatch(hpo));
      }
      default: return NextResponse.json({ error: `unknown tool ${tool}` }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function reply(result: unknown) {
  if (result === null) return NextResponse.json({ data: null, evidence: [], note: "No hay evidencia en nuestras fuentes para esa enfermedad." }, { status: 200 });
  return NextResponse.json(result, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}

/** Si ATLAS_TOOLS_KEY está definida, se exige; si no (desarrollo), pasa. */
function authorized(req: NextRequest) {
  const key = process.env.ATLAS_TOOLS_KEY;
  if (!key) return true;
  return req.headers.get("x-atlas-key") === key;
}
