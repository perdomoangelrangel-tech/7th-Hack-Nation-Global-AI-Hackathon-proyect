/**
 * Agent tools (ElevenLabs server tools). One route, many read-only tools; every reply is { data, evidence[], retrieved_at, note? }.
 * Header `x-atlas-key` must equal ATLAS_TOOLS_KEY when that env var is set (open in local dev).
 *   GET /api/tools/disease?q=Dravet                 profile: genes, phenotypes, neighbors
 *   GET /api/tools/trials?q=ORPHA:33069&country=Mexico
 *   GET /api/tools/treatments?q=Rett
 *   GET /api/tools/literature?q=Angelman&limit=15
 *   GET /api/tools/communities?q=CDKL5              patient organizations + research groups
 *   GET /api/tools/gaps?q=CLN2                      unmet need
 *   GET /api/tools/phenotype-match?hpo=HP:0001250,HP:0001263
 *   GET /api/tools/neighbors?q=STXBP1&limit=6       inferred similar diseases + why
 *   GET /api/tools/cluster?q=STXBP1                 mechanism cluster, members, counterexamples, unmet need
 *   GET /api/tools/explain_path?edges=edge:a,edge:b&persona=maria&locale=en&simple=1
 *   GET /api/tools/resolve?q=SMEI                   name → atlas entity (synonyms), never guesses
 * `q` accepts a disease name, synonym, ORPHA/MONDO id, entity id or gene symbol (strict resolver).
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ai/guard";
import { loadAtlas } from "@/lib/atlas/store";
import { isPersonaId } from "@/lib/agents/profiles";
import { clusterFor, communitiesFor, diseaseProfile, explainPath, gapsFor, literatureFor, neighborsFor, phenotypeMatch, resolveName, treatmentsFor, trialsFor } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = rateLimit(req, "tools", 60); if (limited) return limited;
  await loadAtlas();
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim().slice(0, 300) ?? "";
  const limit = (d: number) => Math.max(1, Math.min(50, Number(sp.get("limit")) || d));

  try {
    switch (tool) {
      case "disease":       return reply(await diseaseProfile(q));
      case "trials":        return reply(await trialsFor(q, sp.get("country") ?? undefined));
      case "treatments":    return reply(await treatmentsFor(q));
      case "literature":    return reply(await literatureFor(q, limit(15)));
      case "communities":   return reply(await communitiesFor(q));
      case "gaps":          return reply(await gapsFor(q));
      case "neighbors":     return reply(await neighborsFor(q, limit(6)));
      case "cluster":       return reply(await clusterFor(q));
      case "resolve":       return reply(await resolveName(q));
      case "explain_path": {
        const edges = (sp.get("edges") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
        if (!edges.length) return NextResponse.json({ error: "edges required (comma-separated edge ids)" }, { status: 400 });
        const persona = sp.get("persona");
        return reply(await explainPath(edges, isPersonaId(persona) ? persona : "maria", sp.get("locale") === "es" ? "es" : "en", sp.get("simple") === "1" || sp.get("simple") === "true"));
      }
      case "phenotype-match": {
        const hpo = (sp.get("hpo") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
        if (!hpo.length) return NextResponse.json({ error: "hpo required" }, { status: 400 });
        return reply(await phenotypeMatch(hpo));
      }
      default: return NextResponse.json({ error: `unknown tool ${tool}` }, { status: 404 });
    }
  } catch (e) {
    console.error(`[tools] ${tool}:`, (e as Error).message);
    return NextResponse.json({ error: "tool failed" }, { status: 500 });
  }
}

function reply(result: unknown) {
  if (result === null) return NextResponse.json({ data: null, evidence: [], note: "That disease is not in the atlas. Say so; do not guess." }, { status: 200 });
  return NextResponse.json(result, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}

/** If ATLAS_TOOLS_KEY is set it is required; otherwise (local dev) tools are open. */
function authorized(req: NextRequest) {
  const key = process.env.ATLAS_TOOLS_KEY;
  if (!key) return true;
  return req.headers.get("x-atlas-key") === key;
}
