/**
 * GET /api/medicines?q=&d=&approved=true&limit=  → { medicines: Medicine[], total, source: "supabase"|"graph", disclaimer }
 * Medicines bank (view medicines_public): each indication lists its sources with links; `bank_url` opens the
 * platform page. Used by the voice agent tool and the atlas node drawer. Never doses or efficacy numbers.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMedicines } from "@/lib/journey/bank-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 300);
  const body = await getMedicines({ q: sp.get("q")?.slice(0, 120) ?? null, d: sp.get("d")?.slice(0, 120) ?? null, approved: sp.get("approved") === "true", limit });
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
