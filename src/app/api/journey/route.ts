/**
 * GET /api/journey?d=disease:ORPHA:599373&p=maria&l=en   → Journey v2 (four questions, steps, gaps, coverage)
 * GET /api/journey?q=Alexander%20disease                 → resolves free text; if the atlas cannot route it,
 *                                                          returns { kind: "no_route", … } (HTTP 200, honest answer)
 * Every card carries `cite: { edges, evidence, kinds }`.
 */
import { NextRequest, NextResponse } from "next/server";
import { journeyFor, parseLocale, parsePersona } from "@/lib/journey/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const d = sp.get("d"); const q = sp.get("q");
  if (!d && !q) return NextResponse.json({ error: "pass d (disease id) or q (free text)" }, { status: 400 });
  const body = await journeyFor({ d, q, persona: parsePersona(sp.get("p")), locale: parseLocale(sp.get("l")) });
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } });
}
