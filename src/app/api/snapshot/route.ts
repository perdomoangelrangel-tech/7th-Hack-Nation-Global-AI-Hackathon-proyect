/**
 * GET /api/snapshot → the live graph trimmed to the snapshot budget.
 * Refresh the offline fallback from a machine that reaches Supabase:
 *   curl -s https://<site>/api/snapshot > src/data/snapshot.json
 * Returns 503 when the graph is unreachable (never re-exports the snapshot itself).
 */
import { NextRequest, NextResponse } from "next/server";
import { exportSnapshot } from "@/lib/atlas-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = process.env.ATLAS_TOOLS_KEY;
  if (key && req.headers.get("x-atlas-key") !== key) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snap = await exportSnapshot();
  if (!snap) return NextResponse.json({ error: "graph unreachable" }, { status: 503 });
  return NextResponse.json(snap, { headers: { "cache-control": "no-store" } });
}
