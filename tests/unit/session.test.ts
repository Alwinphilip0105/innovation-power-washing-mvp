import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session cookie signing.
 *
 * The regression these guard against: a dev server with no AUTH_SECRET signed
 * cookies with a per-process random key, so any worker restart - which Next
 * performs while compiling a route - silently invalidated the session and
 * bounced the user to the login page mid-navigation.
 */

const PAYLOAD = {
  userId: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  email: "owner@example.com",
  role: "owner",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const globalRef = globalThis as unknown as { __ipwAuthSecret?: string };

/** Fresh module registry + cleared cached key = a newly started server worker. */
async function loadSessionModule() {
  delete globalRef.__ipwAuthSecret;
  vi.resetModules();
  return import("@/lib/auth/session");
}

beforeEach(() => {
  delete globalRef.__ipwAuthSecret;
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete globalRef.__ipwAuthSecret;
});

describe("with AUTH_SECRET configured", () => {
  it("round-trips a session and survives a restart", async () => {
    vi.stubEnv("AUTH_SECRET", "a-configured-secret");

    const first = await loadSessionModule();
    const token = first.serializeSession(PAYLOAD);

    const afterRestart = await loadSessionModule();
    expect(afterRestart.parseSession(token)).toMatchObject({
      userId: PAYLOAD.userId,
      businessId: PAYLOAD.businessId,
      role: "owner",
    });
  });
});

describe("without AUTH_SECRET, in development", () => {
  it("keeps the session valid across a worker restart", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    const first = await loadSessionModule();
    const token = first.serializeSession(PAYLOAD);

    // The exact scenario that was signing people out mid-click.
    const afterRestart = await loadSessionModule();
    expect(afterRestart.parseSession(token)).not.toBeNull();
  });
});

describe("without AUTH_SECRET, in production", () => {
  it("deliberately invalidates sessions on restart rather than using a guessable key", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    const first = await loadSessionModule();
    const token = first.serializeSession(PAYLOAD);

    const afterRestart = await loadSessionModule();
    expect(afterRestart.parseSession(token)).toBeNull();
  });
});

describe("tamper resistance", () => {
  it("rejects a modified payload, a bad signature and a missing token", async () => {
    vi.stubEnv("AUTH_SECRET", "a-configured-secret");
    const { serializeSession, parseSession } = await loadSessionModule();

    const token = serializeSession(PAYLOAD);
    const [body, signature] = token.split(".");

    // Re-encoded payload claiming another business, original signature kept.
    const forgedBody = Buffer.from(
      JSON.stringify({ ...PAYLOAD, businessId: "33333333-3333-4333-8333-333333333333" }),
    ).toString("base64url");

    expect(parseSession(`${forgedBody}.${signature}`)).toBeNull();
    expect(parseSession(`${body}.not-the-signature`)).toBeNull();
    expect(parseSession(body)).toBeNull();
    expect(parseSession(undefined)).toBeNull();
    expect(parseSession("")).toBeNull();
  });

  it("rejects an expired session", async () => {
    vi.stubEnv("AUTH_SECRET", "a-configured-secret");
    const { serializeSession, parseSession } = await loadSessionModule();

    const expired = serializeSession({ ...PAYLOAD, exp: Math.floor(Date.now() / 1000) - 1 });
    expect(parseSession(expired)).toBeNull();
  });
});
