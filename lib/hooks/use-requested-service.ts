"use client";

import { useSyncExternalStore } from "react";

/**
 * The `?service=` preselection used by the links into /book.
 *
 * Read from the URL in the browser rather than from `searchParams` on the
 * server: the static export is prerendered once, at build time, with no request
 * to take a query string from. Doing it here keeps one behaviour across both
 * builds instead of a page that silently ignores the parameter on one host.
 *
 * `useSyncExternalStore` is what makes that safe. The server snapshot is empty,
 * so the prerendered HTML and React's first client render agree; the real
 * value then arrives during hydration rather than an effect later, so no
 * consumer ever acts on the wrong service first.
 */
function subscribe(onChange: () => void): () => void {
  // Back/forward navigation is the only thing that rewrites the query string
  // under us; every in-app change remounts these forms anyway.
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const getSearch = () => window.location.search;
const getServerSearch = () => "";

export function useRequestedService(services: Array<{ slug: string }>): string | undefined {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const requested = new URLSearchParams(search).get("service");

  // Only honour a service we actually offer — a hand-edited URL should not be
  // able to put a form into a state with no matching service.
  return requested && services.some((service) => service.slug === requested)
    ? requested
    : undefined;
}
