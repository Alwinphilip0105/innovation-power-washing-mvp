import { beforeEach, vi } from "vitest";

// Tests run entirely against the in-memory store and the mock providers - no
// network, no credentials, no external services.
//
// `Object.assign` rather than direct assignment: @types/node declares
// process.env.NODE_ENV readonly, and the whole point here is to override it.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_STORE: "memory",
  AI_PROVIDER: "mock",
  LOG_LEVEL: "error",
  AUTH_SECRET: "test-secret-not-used-in-production",
  APP_URL: "http://localhost:3000",
});

beforeEach(() => {
  vi.restoreAllMocks();
});
