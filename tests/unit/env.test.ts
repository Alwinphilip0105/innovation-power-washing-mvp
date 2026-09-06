import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Environment parsing.
 *
 * The regression these guard against: the config was parsed all-or-nothing, so
 * a single malformed value discarded *every* variable and fell back to
 * defaults. A fully configured production deployment silently reverted to mock
 * mode - no database, no session secret, so users were signed out on every
 * navigation - and the only trace was a console warning nobody reads.
 */
async function loadEnv(values: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value as string);
  }
  return import("@/lib/env");
}

const GOOD = {
  AUTH_SECRET: "a-configured-secret",
  AUTH_PROVIDER: "dev",
  DATA_STORE: "supabase",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  APP_URL: "https://app.example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a fully configured environment", () => {
  it("is accepted whole", async () => {
    const env = await loadEnv(GOOD);

    expect(env.rejectedEnvKeys).toEqual([]);
    expect(env.env.AUTH_SECRET).toBe("a-configured-secret");
    expect(env.dataStoreKind).toBe("supabase");
    expect(env.appUrl).toBe("https://app.example.com");
  });
});

describe("one invalid value", () => {
  it("does not discard the rest of the configuration", async () => {
    const env = await loadEnv({ ...GOOD, SUPABASE_URL: "definitely-not-a-url" });

    // The offending key is dropped and named...
    expect(env.rejectedEnvKeys).toEqual(["SUPABASE_URL"]);
    expect(env.env.SUPABASE_URL).toBeUndefined();

    // ...but everything else survives. Previously all of this was undefined.
    expect(env.env.AUTH_SECRET).toBe("a-configured-secret");
    expect(env.env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
    expect(env.dataStoreKind).toBe("supabase");
    expect(env.appUrl).toBe("https://app.example.com");
  });

  it("names every offending key, not just the first", async () => {
    const env = await loadEnv({
      ...GOOD,
      SUPABASE_URL: "nope",
      DATA_STORE: "postgres-ish",
    });

    expect(env.rejectedEnvKeys.sort()).toEqual(["DATA_STORE", "SUPABASE_URL"]);
    // Still holds on to the session secret, which is what kept signing people out.
    expect(env.env.AUTH_SECRET).toBe("a-configured-secret");
  });
});

describe("pasted values", () => {
  it("tolerates the trailing newline a dashboard paste leaves behind", async () => {
    const env = await loadEnv({
      ...GOOD,
      SUPABASE_URL: "https://project.supabase.co\n",
      APP_URL: "  https://app.example.com  ",
      AUTH_SECRET: "a-configured-secret\n",
    });

    expect(env.rejectedEnvKeys).toEqual([]);
    expect(env.env.SUPABASE_URL).toBe("https://project.supabase.co");
    expect(env.appUrl).toBe("https://app.example.com");
    expect(env.env.AUTH_SECRET).toBe("a-configured-secret");
  });
});
