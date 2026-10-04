/**
 * GET /api/journey/clusters?l=en            → { rows: ClusterRow[], columns, method }  (Pharma table, ranked by unmet need)
 * GET /api/journey/clusters?l=en&format=csv → text/csv ("Export CSV")
 */
import { NextRequest, NextResponse } from "next/server";
import { graph, parseLocale } from "@/lib/journey/server";
import { clusterCsv, clusterTable } from "@/lib/journey/clusters";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const t = clusterTable(await graph(), parseLocale(sp.get("l")));
  if (sp.get("format") === "csv") return new NextResponse(clusterCsv(t), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="nedamex-clusters.csv"' } });
  return NextResponse.json(t, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } });
}
