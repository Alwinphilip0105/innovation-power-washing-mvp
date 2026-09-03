import { beforeEach, describe, expect, it } from "vitest";

import { clientKey, rateLimit, resetRateLimits } from "@/lib/http/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit and blocks the next one", () => {
    const now = 1_000_000;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(rateLimit("k", 3, 60_000, now).allowed, `attempt ${attempt}`).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("keeps separate counters per key", () => {
    const now = 1_000_000;
    rateLimit("a", 1, 60_000, now);
    expect(rateLimit("a", 1, 60_000, now).allowed).toBe(false);
    expect(rateLimit("b", 1, 60_000, now).allowed).toBe(true);
  });

  it("resets once the window has passed", () => {
    const now = 1_000_000;
    rateLimit("k", 1, 60_000, now);
    expect(rateLimit("k", 1, 60_000, now).allowed).toBe(false);
    expect(rateLimit("k", 1, 60_000, now + 60_001).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first address in x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(clientKey(request, "leads")).toBe("leads:203.0.113.7");
  });

  it("falls back to x-real-ip and then to a constant", () => {
    expect(clientKey(new Request("https://e.com", { headers: { "x-real-ip": "198.51.100.4" } }), "chat")).toBe(
      "chat:198.51.100.4",
    );
    expect(clientKey(new Request("https://e.com"), "chat")).toBe("chat:unknown");
  });
});
