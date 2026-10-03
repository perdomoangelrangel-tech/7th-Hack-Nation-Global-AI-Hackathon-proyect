/**
 * Agent tools (ElevenLabs server tools). One route, read-only, compact JSON (< ~4 KB).
 *   GET /api/tools/catalog                         → tool list + params (agent setup)
 *   GET /api/tools/ask?q=…&audience=family&locale=en → verified answer: speak `spoken` as is
 *   GET /api/tools/diseases
 *   GET /api/tools/disease?q=Dravet
 *   GET /api/tools/treatments?q=ORPHA:778
 *   GET /api/tools/trials?q=Rett&country=Mexico&recruiting=true
 *   GET /api/tools/literature?q=Angelman&limit=5
 *   GET /api/tools/communities?q=CDKL5
 *   GET /api/tools/gaps?q=CLN2
 *   GET /api/tools/connections?q=CDKL5                → diseases sharing evidence, ranked, with next steps
 *   GET /api/tools/phenotype-match?hpo=HP:0001250,HP:0002373
 * Every item: { summary, evidence_ids }. Header x-atlas-key is required when ATLAS_TOOLS_KEY is set.
 * Data: live graph with a 4 s budget, falling back to the bundled snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { getConnections, getDiseaseMap, listDiseases, type DiseaseMap } from "@/lib/atlas-data";
import { resolveDisease } from "@/lib/agents/detect";
import { phenotypeMatch } from "@/lib/graph";
import {
  TOOL_CATALOG, communitiesTool, diseaseTool, emptyTool, fit, gapsTool, literatureTool, matchPhenotypes,
  connectionsTool, phenotypeMatchTool, treatmentsTool, trialsTool, type MatchRow, type ToolResponse,
} from "@/lib/agents/tools";
import { answer } from "@/lib/agents/answer";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  const base = `${req.nextUrl.origin}/api/tools`;
  if (tool === "catalog") {
    return json({
      auth: { header: "x-atlas-key", required: Boolean(process.env.ATLAS_TOOLS_KEY) },
      method: "GET",
      response: "{ tool, disease, retrieved_at, source, total, items: [{ summary, evidence_ids, url? }], note? }",
      rule: "Say only what the items say and cite their evidence_ids. If items is empty, say: There is no evidence in our sources for that.",
      tools: TOOL_CATALOG.map((t) => ({ ...t, url: `${base}/${t.name}` })),
    });
  }
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    if (tool === "diseases") {
      const list = await listDiseases();
      return json({ tool, retrieved_at: new Date().toISOString(), total: list.length, items: list.map((d) => ({ summary: `${d.name} (${d.orpha})${d.name_es ? ` · ES: ${d.name_es}` : ""}`, evidence_ids: [] })) });
    }
    if (tool === "ask") {
      const q = (sp.get("q") ?? sp.get("question") ?? "").trim().slice(0, 1000);
      if (q.length < 2) return NextResponse.json({ error: "q required, e.g. ?q=Is there a treatment for Rett?" }, { status: 400 });
      const audience = (["family", "clinical", "research"] as const).find((a) => a === sp.get("audience")) ?? "family";
      const locale = sp.get("locale") === "es" ? "es" : "en";
      const { map, out } = await answer({ question: q, audience, locale, disease: sp.get("disease") ?? undefined });
      return json(fit({
        tool, disease: map ? { orpha: map.disease.orpha, name: map.disease.name, name_es: map.disease.name_es } : null,
        retrieved_at: map?.retrieved_at ?? new Date().toISOString(), source: map?.source ?? "none",
        spoken: out.spoken, verified: out.verified, dropped: out.dropped.length,
        total: out.claims.length, items: out.claims.map((c) => ({ summary: c.text, evidence_ids: c.evidence_ids.slice(0, 3) })),
      } as ToolResponse));
    }
    if (tool === "phenotype-match") {
      const hpo = (sp.get("hpo") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
      if (!hpo.length) return NextResponse.json({ error: "hpo required, e.g. ?hpo=HP:0001250" }, { status: 400 });
      return json(await matchTool(hpo));
    }
    if (!TOOL_CATALOG.some((t) => t.name === tool)) return NextResponse.json({ error: `unknown tool ${tool}`, catalog: `${base}/catalog` }, { status: 404 });

    const q = sp.get("q")?.trim() ?? "";
    const d = resolveDisease(q, await listDiseases());
    if (tool === "connections") {
      const conn = d ? await getConnections(d.orpha) : null;
      return json(conn ? connectionsTool(conn) : emptyTool(tool, "There is no evidence in our sources for that disease."));
    }
    const map = d ? await getDiseaseMap(d.orpha) : null;
    if (!map) return json(emptyTool(tool, "There is no evidence in our sources for that disease."));
    return json(run(tool, map, sp));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function run(tool: string, map: DiseaseMap, sp: URLSearchParams) {
  switch (tool) {
    case "disease": return diseaseTool(map);
    case "treatments": return treatmentsTool(map);
    case "trials": return trialsTool(map, { country: sp.get("country") ?? undefined, recruiting: sp.get("recruiting") === "true" });
    case "literature": return literatureTool(map, Number(sp.get("limit") ?? 5) || 5);
    case "communities": return communitiesTool(map);
    case "gaps": return gapsTool(map);
    default: return emptyTool(tool, "unknown tool");
  }
}

async function matchTool(hpo: string[]) {
  // Live graph first (all diseases), then the atlas maps (snapshot-backed when the graph is unreachable).
  try {
    const live = await Promise.race([
      phenotypeMatch(hpo),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const rows = (live?.data ?? []) as { disease: string; canonical_id: string; score: number; matched: string[]; evidence_ids: string[] }[];
    if (rows.length) {
      const mapped: MatchRow[] = rows.map((r) => ({ orpha: r.canonical_id, name: r.disease, score: Math.round(Number(r.score) * 100) / 100, matched: r.matched, evidence_ids: r.evidence_ids }));
      return phenotypeMatchTool(mapped, "live", live!.retrieved_at);
    }
  } catch { /* fall through to maps */ }
  const maps = (await Promise.all((await listDiseases()).map((d) => getDiseaseMap(d.orpha)))).filter((m): m is DiseaseMap => !!m);
  return fit(phenotypeMatchTool(matchPhenotypes(maps, hpo), maps[0]?.source ?? "none", maps[0]?.retrieved_at ?? new Date().toISOString()));
}

function json(body: unknown) {
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}

/** If ATLAS_TOOLS_KEY is set it is required; otherwise (development) requests pass. */
function authorized(req: NextRequest) {
  const key = process.env.ATLAS_TOOLS_KEY;
  if (!key) return true;
  return req.headers.get("x-atlas-key") === key;
}
