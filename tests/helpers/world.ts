import { setStore } from "@/lib/db";
import { MemoryStore } from "@/lib/db/memory-store";
import { buildSeedData, type SeedData } from "@/lib/db/seed";
import { clearHandlers } from "@/lib/events/bus";
import { registerAutomations, resetAutomationsRegistration } from "@/lib/events/handlers";
import { clearEmailOutbox } from "@/lib/notifications/providers";
import { resetRateLimits } from "@/lib/http/rate-limit";
import type { Business, Service } from "@/lib/db/types";

/**
 * One store instance for the whole suite, reset between tests.
 *
 * Reusing the instance (rather than swapping in a new one) keeps any
 * request-scoped memoisation in the service layer pointing at live data, while
 * `reset()` still gives each test the pristine seed dataset.
 */
const store = new MemoryStore();
setStore(store);

export interface World {
  store: MemoryStore;
  business: Business;
  services: Service[];
  seed: SeedData;
  service(slug: string): Service;
}

export function resetWorld(now: Date = new Date()): World {
  const seed = buildSeedData(now);

  store.reset(seed);
  clearHandlers();
  resetAutomationsRegistration();
  registerAutomations();
  clearEmailOutbox();
  resetRateLimits();

  const business = seed.businesses[0];

  return {
    store,
    business,
    services: seed.services,
    seed,
    service(slug: string) {
      const found = seed.services.find((candidate) => candidate.slug === slug);
      if (!found) throw new Error(`No seeded service "${slug}"`);
      return found;
    },
  };
}

/** A weekday inside business hours, far from any DST boundary. */
export const TEST_NOW = new Date("2026-06-08T11:00:00.000Z"); // Monday 7am America/New_York
