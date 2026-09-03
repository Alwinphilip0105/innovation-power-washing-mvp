import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logging/logger";

function captureLog(fn: () => void): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((value: unknown) => {
    lines.push(JSON.parse(String(value)));
  });
  fn();
  spy.mockRestore();
  return lines;
}

describe("logger redaction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never writes a value whose key looks like a secret", () => {
    const [line] = captureLog(() =>
      logger.error("provider call failed", {
        apiKey: "sk-live-should-not-appear",
        authorization: "Bearer nope",
        nested: { service_role_key: "also-secret", safe: "keep-me" },
      }),
    );

    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain("sk-live-should-not-appear");
    expect(serialized).not.toContain("also-secret");
    expect(line.apiKey).toBe("[redacted]");
    expect((line.nested as Record<string, unknown>).safe).toBe("keep-me");
  });

  it("emits structured JSON with the operational fields we search on", () => {
    const [line] = captureLog(() =>
      logger.error("tool failed", {
        requestId: "req-1",
        businessId: "biz-1",
        event: "ai.tool",
        success: false,
        latencyMs: 12,
      }),
    );

    expect(line).toMatchObject({
      level: "error",
      msg: "tool failed",
      requestId: "req-1",
      businessId: "biz-1",
      event: "ai.tool",
      success: false,
      latencyMs: 12,
    });
    expect(typeof line.time).toBe("string");
  });

  it("merges child context into every call", () => {
    const child = logger.child({ businessId: "biz-2", requestId: "req-2" });
    const [line] = captureLog(() => child.error("boom", { event: "x" }));
    expect(line).toMatchObject({ businessId: "biz-2", requestId: "req-2", event: "x" });
  });
});
