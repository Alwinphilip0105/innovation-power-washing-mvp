import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { corsAllowedOrigins } from "@/lib/env";

/**
 * CORS for the public browser API.
 *
 * The static GitHub Pages build serves the site from a different origin than
 * the deployment that answers its API calls, so those calls are cross-origin
 * and the browser preflights them. Only origins named in
 * `CORS_ALLOWED_ORIGINS` (comma separated) get CORS headers back; every other
 * origin is left to the browser's default same-origin policy, which blocks it.
 *
 * Scoped to the endpoints a browser is meant to call. The webhook routes are
 * for vendors, are authenticated by signature, and are deliberately not here.
 *
 * These endpoints carry no cookies — nothing behind sign-in is reachable
 * cross-origin — so no `Allow-Credentials` is issued and a stolen origin gains
 * no session.
 *
 * Note: this reads config at build time on an edge deployment, so changing
 * `CORS_ALLOWED_ORIGINS` requires a redeploy, not just an env edit.
 */
const ALLOWED_ORIGINS = new Set(corsAllowedOrigins);

export const config = {
  matcher: [
    "/api/chat",
    "/api/leads",
    "/api/availability",
    "/api/appointments",
    "/api/demo/:path*",
    "/api/health",
  ],
};

/** Echoes the matched origin rather than `*`, so the allowlist stays meaningful. */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin.replace(/\/+$/, "")) ? origin : null;

  // Preflight is answered here and never reaches the route handler, so it is
  // not charged against that route's rate limit.
  if (request.method === "OPTIONS") {
    return allowedOrigin
      ? new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin) })
      : new NextResponse(null, { status: 403 });
  }

  const response = NextResponse.next();
  if (allowedOrigin) {
    for (const [key, value] of Object.entries(corsHeaders(allowedOrigin))) {
      response.headers.set(key, value);
    }
  }
  return response;
}
