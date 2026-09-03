import { cache } from "react";

import { getStore } from "@/lib/db";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/config/business";
import type { Business, Service } from "@/lib/db/types";

/**
 * Tenant resolution. Today the platform serves one business, so the default
 * slug is used; the seam is here so a future deployment can resolve the tenant
 * from the hostname or a path segment without touching any caller.
 */
export const getCurrentBusiness = cache(async (slug: string = DEFAULT_BUSINESS_SLUG): Promise<Business> => {
  const store = getStore();
  const business = (await store.getBusinessBySlug(slug)) ?? (await store.listBusinesses())[0];

  if (!business) {
    throw new Error(
      `No business found for slug "${slug}". Seed the database (npm run db:seed) or check DATA_STORE configuration.`,
    );
  }
  return business;
});

export const getActiveServices = cache(async (businessId: string): Promise<Service[]> => {
  return getStore().listServices(businessId, { activeOnly: true });
});

export const getAllServices = cache(async (businessId: string): Promise<Service[]> => {
  return getStore().listServices(businessId);
});

/** Resolves a service by id or slug, scoped to the business. */
export async function resolveService(
  businessId: string,
  ref: { serviceId?: string | null; serviceSlug?: string | null },
): Promise<Service | null> {
  const store = getStore();
  if (ref.serviceId) {
    const byId = await store.getServiceById(businessId, ref.serviceId);
    if (byId) return byId;
  }
  if (ref.serviceSlug) {
    return store.getServiceBySlug(businessId, ref.serviceSlug);
  }
  return null;
}
