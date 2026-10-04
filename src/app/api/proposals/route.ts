/**
 * GET  /api/proposals?d=disease:ORPHA:599373  → { proposals: ProposalPublic[], sources } (no contact column, ever)
 * POST /api/proposals  ProposalInput          → { ok, id, stored: "supabase" | "local", proposal, dropped_edges }
 * Drafts are never evidence (edge_kind "proposed"). Unknown edge/entity ids are dropped, not stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { graph } from "@/lib/journey/server";
import { ProposalInput } from "@/lib/journey/proposals";
import { listProposals, saveProposal } from "@/lib/journey/proposals-store";
import { honeypotTripped, rateLimit, readJson, tooMany } from "@/lib/journey/guard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d");
  const body = await listProposals(d && d.length <= 120 ? d : null);
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  // WAVE 7: 5 submissions/min per IP · JSON ≤ 32 kB · control chars stripped · honeypot rejected.
  const rl = rateLimit(req, "proposals", 5);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson(req);
  if (!read.ok) return read.res;
  if (honeypotTripped(read.body)) return NextResponse.json({ ok: false, error: "rejected" }, { status: 400 });
  const raw = read.body;
  const parsed = ProposalInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid proposal", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (parsed.data.contact && !parsed.data.consent) return NextResponse.json({ ok: false, error: "contact details need explicit consent" }, { status: 400 });
  const saved = await saveProposal(await graph(), parsed.data);
  return NextResponse.json(saved, { status: 201 });
}
