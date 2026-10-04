/**
 * GET /api/community?d=&q=&limit= → { profiles: CommunityProfile[], total, sources, note }
 * NIH RePORTER grant records (view community_profiles_public, each project with its RePORTER link) +
 * self-submitted profiles (profile_submissions, badged "Self-submitted · not verified"). No contact data.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCommunity } from "@/lib/journey/bank-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 200);
  const body = await getCommunity({ d: sp.get("d")?.slice(0, 120) ?? null, q: sp.get("q")?.slice(0, 120) ?? null, limit });
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
