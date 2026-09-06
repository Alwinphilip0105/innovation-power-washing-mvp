import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The seams that let this app ship as a static site with no server.
 *
 * These are the pieces that fail silently if they regress: a wrong origin on a
 * sign-in link is a 404 nobody notices, and a missing CORS header is only ever
 * visible in a browser console.
 */

/** Fresh module registry — these modules read their config once, at load. */
async function loadOrigin(base?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", base ?? "");
  return import("@/lib/api/origin");
}

async function loadMiddleware(allowed: string) {
  vi.resetModules();
  vi.stubEnv("CORS_ALLOWED_ORIGINS", allowed);
  return import("@/middleware");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server origin", () => {
  it("stays same-origin when nothing is configured", async () => {
    const { serverHref, isRemoteServer } = await loadOrigin();

    expect(isRemoteServer).toBe(false);
    expect(serverHref("/login")).toBe("/login");
  });

  it("points sign-in and the dashboard at the configured deployment", async () => {
    const { serverHref, isRemoteServer } = await loadOrigin("https://app.example.com");

    expect(isRemoteServer).toBe(true);
    expect(serverHref("/login")).toBe("https://app.example.com/login");
    expect(serverHref("/dashboard/calls")).toBe("https://app.example.com/dashboard/calls");
  });

  it("does not double the slash when the base has a trailing one", async () => {
    const { serverHref } = await loadOrigin("https://app.example.com/");

    expect(serverHref("/login")).toBe("https://app.example.com/login");
  });
});

describe("in-browser transport", () => {
  /**
   * The static build swaps this in for the fetch transport. It has to behave
   * like the network one, because every caller treats the result as a
   * `Response` and never learns which it got.
   */
  it("answers the real endpoints with a Response, without any network", async () => {
    vi.resetModules();
    vi.stubEnv("DATA_STORE", "memory");
    vi.stubGlobal("window", { location: { origin: "https://example.github.io" } });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { callApi } = await import("@/lib/api/transport-browser");

    const response = await callApi("/api/availability?serviceSlug=house-washing&days=3");
    const payload = (await response.json()) as { ok: boolean; data?: { days: unknown[] } };

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data?.days)).toBe(true);

    // The whole point: nothing left the page.
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("validates exactly as the server does, rather than trusting the caller", async () => {
    vi.resetModules();
    vi.stubEnv("DATA_STORE", "memory");
    vi.stubGlobal("window", { location: { origin: "https://example.github.io" } });

    const { callApi } = await import("@/lib/api/transport-browser");

    const response = await callApi("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "" }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: false });

    vi.unstubAllGlobals();
  });

  it("404s an endpoint the demo does not carry", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { origin: "https://example.github.io" } });

    const { callApi } = await import("@/lib/api/transport-browser");
    const response = await callApi("/api/webhooks/sms", { method: "POST", body: "{}" });

    expect(response.status).toBe(404);

    vi.unstubAllGlobals();
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
