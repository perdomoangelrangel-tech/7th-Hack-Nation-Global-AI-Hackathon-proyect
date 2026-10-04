import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CORS_HEADERS, isAllowedOrigin } from "@/lib/cors";

// CORS for the Lovable app calling this deployment's /api/*.
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = isAllowedOrigin(origin);

  if (request.method === "OPTIONS") {
    const headers: Record<string, string> = { Vary: "Origin" };
    if (allowed && origin) Object.assign(headers, CORS_HEADERS, { "Access-Control-Allow-Origin": origin });
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  response.headers.append("Vary", "Origin");
  if (allowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
