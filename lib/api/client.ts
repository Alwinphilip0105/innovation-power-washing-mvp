/**
 * Where the app's server lives, as seen from the browser.
 *
 * Normally empty, so every request and link stays same-origin — the site and
 * its API are one deployment.
 *
 * The GitHub Pages build is the exception: it is a static export with no server
 * of its own, so it is built with `NEXT_PUBLIC_API_BASE_URL` pointing at the
 * deployment that does have one. The API routes, sign-in and the owner
 * dashboard all live there; only the marketing pages and the demo shells are
 * served by Pages.
 *
 * Read as a literal `process.env.NEXT_PUBLIC_*` on purpose: Next inlines those
 * into the client bundle by textual substitution. `lib/env.ts` parses
 * `process.env` as an object, which works server-side but leaves the browser
 * with nothing, so this value must not come from there.
 */
const SERVER_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/** True when this bundle has to reach its API cross-origin (the Pages build). */
export const isRemoteServer = SERVER_ORIGIN !== "";

/** URL for a `fetch` against our own API, wherever that API is deployed. */
export function apiUrl(path: `/api/${string}`): string {
  return `${SERVER_ORIGIN}${path}`;
}

/**
 * URL for a page only the full deployment can render — anything behind sign-in.
 * These are plain `<a>` links rather than `<Link>` because in the Pages build
 * they genuinely leave the site.
 */
export function serverHref(path: string): string {
  return `${SERVER_ORIGIN}${path}`;
}
