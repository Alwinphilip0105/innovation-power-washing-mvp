import { SERVER_ORIGIN } from "@/lib/api/origin";

/**
 * How the browser reaches the API: over HTTP, to a real server.
 *
 * `scripts/build-static.mjs` replaces this file with `transport-browser.ts`
 * for the self-contained static build, where there is no server to reach and
 * the same handlers run in the page instead. Everything that calls `callApi`
 * is identical either way.
 */
export function callApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SERVER_ORIGIN}${path}`, init);
}
