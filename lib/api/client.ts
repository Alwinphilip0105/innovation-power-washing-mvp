/**
 * The one import the UI uses to reach the API and the server-rendered pages.
 *
 * `callApi` comes from `transport`, which is swapped for an in-browser
 * implementation in the self-contained static build - see `lib/api/transport.ts`.
 */
export { callApi } from "@/lib/api/transport";
export { isRemoteServer, serverHref } from "@/lib/api/origin";
