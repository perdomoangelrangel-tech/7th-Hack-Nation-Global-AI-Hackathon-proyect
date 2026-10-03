/**
 * Vistas de solo lectura del atlas.
 *   GET /api/atlas/search?q=SMEI&l=es        búsqueda global con sinónimos (enfermedad, gen, síntoma, vía, grupo)
 *   GET /api/atlas/graph?d=disease:ORPHA:599373  nodos y aristas centrados en una enfermedad
 *   GET /api/atlas/journey?d=...             conexión -> activo -> colaborador -> siguiente paso
 *   GET /api/atlas/edge?id=edge:...          fuente, tipo, confianza y evidencia en contra de una arista
 *   GET /api/atlas/diseases                  lista para el selector
 *   GET /api/atlas/stats                     tamaño del grafo
 */
import { NextRequest, NextResponse } from "next/server";
import { loadAtlas, constellation, diseaseList, edgeDetail, graphView, journey, search, stats, type Locale } from "@/lib/atlas/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ view: string }> }) {
  await loadAtlas();
  const { view } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const l: Locale = sp.get("l") === "es" ? "es" : "en";
  const d = sp.get("d") ?? "";
  const ok = (data: unknown) => NextResponse.json(data, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  const missing = (what: string) => NextResponse.json({ error: `${what} not found` }, { status: 404 });

  switch (view) {
    case "search": return ok({ hits: search(sp.get("q") ?? "", l) });
    case "graph": { const g = graphView(d, l); return g ? ok(g) : missing("disease"); }
    case "journey": { const j = journey(d, l); return j ? ok(j) : missing("disease"); }
    case "edge": { const e = edgeDetail(sp.get("id") ?? "", l); return e ? ok(e) : missing("edge"); }
    case "constellation": return ok(constellation(l));
    case "diseases": return ok({ diseases: diseaseList(l) });
    case "stats": return ok(stats());
    default: return NextResponse.json({ error: `unknown view ${view}` }, { status: 404 });
  }
}
