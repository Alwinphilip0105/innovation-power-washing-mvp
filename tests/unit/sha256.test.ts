import { createHash, createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { newId, stableId } from "@/lib/utils/id";
import { constantTimeEquals, hmacSha256Hex, sha256Hex } from "@/lib/utils/sha256";

/**
 * The id helpers have to run in a browser as well as on the server, so they no
 * longer use `node:crypto`. These pin the replacement against the real thing:
 * if the two ever disagree, every seeded demo id shifts depending on where the
 * code ran, and the static export stops matching the deployment.
 */
describe("sha256Hex", () => {
  const cases = [
    "",
    "a",
    "abc",
    "business:innovation-power-washing",
    "service:house-washing",
    // Crosses the 55/64-byte padding boundaries in both directions.
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(63),
    "x".repeat(64),
    "x".repeat(65),
    "x".repeat(200),
    // Multi-byte UTF-8 must be hashed as bytes, not code units.
    "café — Pompton Lakes, NJ 🚿",
  ];

  it.each(cases)("matches node:crypto for %j", (text) => {
    expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
  });
});

describe("stableId", () => {
  it("is deterministic for the same namespace and key", () => {
    expect(stableId("service", "house-washing")).toBe(stableId("service", "house-washing"));
  });

  // Documented, not endorsed: the namespace and key are joined with ":" and
  // hashed, so a key containing ":" can collide with a different namespace.
  // Harmless with the namespaces actually in use ("business", "service", ...),
  // and changing the derivation would renumber every seeded demo record.
  it("joins namespace and key without escaping them", () => {
    expect(stableId("a", "b:c")).toBe(stableId("a:b", "c"));
  });

  it("produces something Postgres accepts as a v4 uuid", () => {
    const id = stableId("business", "innovation-power-washing");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("newId", () => {
  it("returns a distinct, well-formed uuid each time", () => {
    const ids = new Set(Array.from({ length: 50 }, newId));

    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    // Same shape the platform's own generator produces.
    expect(newId()).toHaveLength(randomUUID().length);
  });
});

describe("hmacSha256Hex", () => {
  const cases: Array<[string, string]> = [
    ["secret", "hello"],
    ["", ""],
    // A key longer than the 64-byte block, which HMAC hashes down first.
    ["k".repeat(100), "body"],
    ["k".repeat(64), "exactly one block of key"],
    ["whsec_abc123", JSON.stringify({ from: "+19735550100", body: "yes please" })],
  ];

  it.each(cases)("matches node:crypto for key %j", (key, message) => {
    expect(hmacSha256Hex(key, message)).toBe(
      createHmac("sha256", key).update(message).digest("hex"),
    );
  });
});

describe("constantTimeEquals", () => {
  it("accepts identical digests and rejects any difference", () => {
    const digest = sha256Hex("a");

    expect(constantTimeEquals(digest, digest)).toBe(true);
    expect(constantTimeEquals(digest, sha256Hex("b"))).toBe(false);
    expect(constantTimeEquals(digest, digest.slice(0, -1))).toBe(false);
  });
});
