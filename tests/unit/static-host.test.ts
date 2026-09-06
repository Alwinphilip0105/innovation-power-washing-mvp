import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The two seams that let the site be served from a static host (GitHub Pages)
 * while its API stays on a deployment that has a server.
 *
 * These are the pieces that fail silently if they regress: a same-origin URL
 * built into the Pages bundle 404s against a host with no API, and a missing
 * CORS header is only ever visible in a browser console.
 */

/** Fresh module registry — both modules read their config once, at load. */
async function loadApiClient(base?: string) {
  vi.resetModules();
  if (base === undefined) vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", base);
  return import("@/lib/api/client");
}

async function loadMiddleware(allowed: string) {
  vi.resetModules();
  vi.stubEnv("CORS_ALLOWED_ORIGINS", allowed);
  return import("@/middleware");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api client", () => {
  it("stays same-origin when no API base is configured", async () => {
    const { apiUrl, serverHref, isRemoteServer } = await loadApiClient();

    expect(isRemoteServer).toBe(false);
    expect(apiUrl("/api/chat")).toBe("/api/chat");
    expect(serverHref("/login")).toBe("/login");
  });

  it("points at the configured deployment for the static build", async () => {
    const { apiUrl, serverHref, isRemoteServer } = await loadApiClient("https://app.example.com");

    expect(isRemoteServer).toBe(true);
    expect(apiUrl("/api/chat")).toBe("https://app.example.com/api/chat");
    expect(serverHref("/dashboard/calls")).toBe("https://app.example.com/dashboard/calls");
  });

  it("does not double the slash when the base has a trailing one", async () => {
    const { apiUrl } = await loadApiClient("https://app.example.com/");

    expect(apiUrl("/api/leads")).toBe("https://app.example.com/api/leads");
  });
});

describe("cors", () => {
  const PAGES = "https://someone.github.io";

  function request(origin: string | null, method = "POST") {
    return new Request("https://app.example.com/api/chat", {
      method,
      headers: origin ? { origin } : {},
    });
  }

  it("answers a preflight from an allowed origin without reaching the route", async () => {
    const { middleware } = await loadMiddleware(PAGES);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest is a Request at runtime.
    const response = middleware(request(PAGES, "OPTIONS") as any);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PAGES);
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("refuses a preflight from an origin that is not on the allowlist", async () => {
    const { middleware } = await loadMiddleware(PAGES);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest is a Request at runtime.
    const response = middleware(request("https://attacker.example", "OPTIONS") as any);

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("echoes the matched origin rather than a wildcard", async () => {
    const { middleware } = await loadMiddleware(`${PAGES},https://other.example`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest is a Request at runtime.
    const response = middleware(request("https://other.example") as any);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://other.example");
    // No credentials are ever granted: these endpoints carry no session.
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("adds nothing for a same-origin request", async () => {
    const { middleware } = await loadMiddleware(PAGES);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest is a Request at runtime.
    const response = middleware(request(null) as any);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("allows nothing when the allowlist is unset", async () => {
    const { middleware } = await loadMiddleware("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest is a Request at runtime.
    const response = middleware(request(PAGES, "OPTIONS") as any);

    expect(response.status).toBe(403);
  });
});
