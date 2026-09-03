import "server-only";

import { dataStoreKind } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { MemoryStore } from "@/lib/db/memory-store";
import { SupabaseStore } from "@/lib/db/supabase-store";
import type { DataStore } from "@/lib/db/store";

/**
 * Store singleton. Kept on `globalThis` so Next's dev-mode module reloading
 * does not wipe the in-memory dataset on every edit.
 */
const globalRef = globalThis as unknown as { __ipwDataStore?: DataStore };

function create(): DataStore {
  if (dataStoreKind === "supabase") {
    logger.info("data store initialised", { provider: "supabase" });
    return new SupabaseStore();
  }

  logger.info("data store initialised", { provider: "memory" });
  return new MemoryStore();
}

export function getStore(): DataStore {
  if (!globalRef.__ipwDataStore) {
    globalRef.__ipwDataStore = create();
  }
  return globalRef.__ipwDataStore;
}

/** Test seam — swap in a fixture store. */
export function setStore(store: DataStore) {
  globalRef.__ipwDataStore = store;
}

export type { DataStore };
