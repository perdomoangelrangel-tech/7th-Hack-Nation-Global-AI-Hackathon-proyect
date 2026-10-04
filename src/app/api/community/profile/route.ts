/**
 * POST /api/community/profile  { display_name, role, institution?, diseases[], focus?, orcid?, link?, consent: true }
 * → 201 { ok, id, dropped_diseases } via RPC submit_profile. Consent is required (400 without it).
 * The profile is listed as "Self-submitted · not verified" and never counts as evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { ProfileInput } from "@/lib/journey/community";
import { submitProfile } from "@/lib/journey/bank-store";
import { honeypotTripped, rateLimit, readJson, tooMany } from "@/lib/journey/guard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // WAVE 7: 5 submissions/min per IP (the SQL RPC is rate-limited too) · JSON ≤ 32 kB · honeypot rejected.
  const rl = rateLimit(req, "profile", 5);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson(req);
  if (!read.ok) return read.res;
  if (honeypotTripped(read.body)) return NextResponse.json({ ok: false, error: "rejected" }, { status: 400 });
  const parsed = ProfileInput.safeParse(read.body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid profile", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const r = await submitProfile(parsed.data);
  if (!r.ok) return NextResponse.json(r, { status: 503 });
  return NextResponse.json(r, { status: 201 });
}
