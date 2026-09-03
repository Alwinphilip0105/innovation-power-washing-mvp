import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { normalizeEmail, normalizePhone } from "@/lib/utils/phone";
import type { Address, Customer } from "@/lib/db/types";

export interface CustomerIdentity {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface CustomerAddressInput {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Phone-first customer de-duplication, falling back to email.
 *
 * Every intake path (form, chat, SMS, phone) routes through here, which is what
 * keeps a repeat caller from becoming five customer records. Missing fields on
 * an existing record are filled in; existing values are never overwritten by a
 * thinner source.
 */
export async function findOrCreateCustomer(
  businessId: string,
  identity: CustomerIdentity,
): Promise<{ customer: Customer; created: boolean }> {
  const store = getStore();
  const phone = normalizePhone(identity.phone);
  const email = normalizeEmail(identity.email);

  let existing: Customer | null = null;
  if (phone) existing = await store.findCustomerByPhone(businessId, phone);
  if (!existing && email) existing = await store.findCustomerByEmail(businessId, email);

  if (existing) {
    const patch: Partial<Customer> = {};
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.email && email) patch.email = email;
    if (!existing.last_name && identity.lastName) patch.last_name = identity.lastName;
    if (identity.notes) {
      patch.notes = existing.notes ? `${existing.notes}\n${identity.notes}` : identity.notes;
    }

    const customer = Object.keys(patch).length
      ? await store.updateCustomer(businessId, existing.id, patch)
      : existing;

    return { customer, created: false };
  }

  const customer = await store.createCustomer({
    business_id: businessId,
    first_name: identity.firstName,
    last_name: identity.lastName ?? null,
    phone,
    email,
    notes: identity.notes ?? null,
  });

  logger.info("customer created", { businessId, event: "customer.created", customerId: customer.id });
  return { customer, created: true };
}

/** Adds an address unless an identical one is already on file. */
export async function upsertCustomerAddress(
  customerId: string,
  input: CustomerAddressInput,
): Promise<Address> {
  const store = getStore();
  const existing = await store.listAddressesByCustomer(customerId);

  const match = existing.find(
    (address) =>
      address.street.toLowerCase() === input.street.toLowerCase() &&
      address.zip === input.zip,
  );
  if (match) return match;

  return store.createAddress({
    customer_id: customerId,
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
    latitude: null,
    longitude: null,
  });
}

export function customerName(customer: Pick<Customer, "first_name" | "last_name">): string {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ");
}
