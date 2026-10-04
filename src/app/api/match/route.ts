/**
 * GET /api/match?d=disease:ORPHA:599373&p=maria&l=en&n=6
 * → { disease, persona, partners: [{ id, name, kind, score, diseases, reasons:[{code,text,weight,edges}], cite }], method }
 */
import { NextRequest, NextResponse } from "next/server";
import { graph, parseLocale, parsePersona } from "@/lib/journey/server";
import { matchPartners } from "@/lib/journey/match";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const n = Math.min(Math.max(Number(sp.get("n") ?? 6) || 6, 1), 20);
  const r = matchPartners(await graph(), sp.get("d") ?? "", parsePersona(sp.get("p")), parseLocale(sp.get("l")), n);
  if (!r) return NextResponse.json({ error: "disease not found" }, { status: 404 });
  return NextResponse.json(r, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } });
}
