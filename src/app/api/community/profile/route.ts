/**
 * POST /api/community/profile  { display_name, role, institution?, diseases[], focus?, orcid?, link?, consent: true }
 * → 201 { ok, id, dropped_diseases } via RPC submit_profile. Consent is required (400 without it).
 * The profile is listed as "Self-submitted · not verified" and never counts as evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { ProfileInput } from "@/lib/journey/community";
import { submitProfile } from "@/lib/journey/bank-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = ProfileInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid profile", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const r = await submitProfile(parsed.data);
  if (!r.ok) return NextResponse.json(r, { status: 503 });
  return NextResponse.json(r, { status: 201 });
}
