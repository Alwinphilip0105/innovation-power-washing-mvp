/**
 * Where the app's server lives, as seen from the browser.
 *
 * Empty for a single deployment that serves both the site and its API, so
 * every link stays same-origin. The static build sets it to the deployment
 * that has a server, because sign-in and the owner dashboard only exist there.
 *
 * Read as a literal `process.env.NEXT_PUBLIC_*` on purpose: Next inlines those
 * into the client bundle by textual substitution. `lib/env.ts` parses
 * `process.env` as an object, which works server-side but leaves the browser
 * with nothing, so this value must not come from there.
 */
export const SERVER_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/** True when pages behind sign-in live on a different origin than this bundle. */
export const isRemoteServer = SERVER_ORIGIN !== "";

/**
 * URL for a page only a real deployment can render - anything behind sign-in.
 * These are plain `<a>` links because in the static build they leave the site.
 */
export function serverHref(path: string): string {
  return `${SERVER_ORIGIN}${path}`;
}
