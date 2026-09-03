import { randomUUID, createHash } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

/**
 * Deterministic id derived from a namespace + key. Used so seeded demo records
 * and idempotency keys stay stable across restarts.
 */
export function stableId(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Force a v4-shaped uuid so Postgres `uuid` columns accept it.
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}
