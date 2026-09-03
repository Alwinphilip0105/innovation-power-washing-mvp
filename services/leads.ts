import { getStore } from "@/lib/db";
import { emit } from "@/lib/events/bus";
import { logger } from "@/lib/logging/logger";
import { resolveService } from "@/services/business";
import { findOrCreateCustomer, upsertCustomerAddress } from "@/services/customers";
import type { LeadFormValues } from "@/lib/validation/schemas";
import type {
  Address,
  Appointment,
  Business,
  Call,
  Conversation,
  Customer,
  Estimate,
  Lead,
  LeadSource,
  LeadStatus,
  Service,
} from "@/lib/db/types";

export interface CaptureLeadInput {
  business: Business;
  source: LeadSource;
  identity: {
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  address?: { street: string; city: string; state: string; zip: string };
  serviceId?: string | null;
  serviceSlug?: string | null;
  serviceRequested?: string | null;
  preferredDate?: string | null;
  notes?: string | null;
  status?: LeadStatus;
}

export interface CaptureLeadResult {
  lead: Lead;
  customer: Customer;
  service: Service | null;
  address: Address | null;
  /** True when an open lead already existed and was reused rather than duplicated. */
  deduplicated: boolean;
}

/** Statuses that mean "this enquiry is still being worked" — reused, not duplicated. */
const OPEN_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "estimate_requested", "estimate_sent"];

/**
 * The single intake path for every channel. Creates or reuses the customer,
 * attaches the address, then either updates the customer's existing open lead
 * for the same service or creates a new one.
 */
export async function captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const store = getStore();
  const businessId = input.business.id;

  const { customer } = await findOrCreateCustomer(businessId, input.identity);

  const address = input.address ? await upsertCustomerAddress(customer.id, input.address) : null;

  const service = await resolveService(businessId, {
    serviceId: input.serviceId,
    serviceSlug: input.serviceSlug,
  });

  const serviceRequested = input.serviceRequested ?? service?.name ?? null;

  const openLeads = await store.listLeads(businessId, {
    customerId: customer.id,
    status: OPEN_STATUSES,
  });
  const duplicate = openLeads.find(
    (lead) => (service ? lead.service_id === service.id : lead.service_requested === serviceRequested),
  );

  if (duplicate) {
    const merged = [duplicate.notes, input.notes].filter(Boolean).join("\n");
    const lead = await store.updateLead(businessId, duplicate.id, {
      notes: merged || null,
      preferred_date: input.preferredDate ?? duplicate.preferred_date,
      source: duplicate.source,
    });

    logger.info("lead deduplicated", {
      businessId,
      event: "lead.deduplicated",
      leadId: lead.id,
      customerId: customer.id,
    });

    return { lead, customer, service, address, deduplicated: true };
  }

  const lead = await store.createLead({
    business_id: businessId,
    customer_id: customer.id,
    source: input.source,
    service_requested: serviceRequested,
    service_id: service?.id ?? null,
    status: input.status ?? "new",
    estimated_value: service?.starting_price ?? null,
    notes: input.notes ?? null,
    assigned_to: null,
    preferred_date: input.preferredDate ?? null,
  });

  logger.info("lead created", {
    businessId,
    event: "lead.created",
    leadId: lead.id,
    customerId: customer.id,
    provider: input.source,
  });

  await emit("lead.created", { business: input.business, lead, customer });

  return { lead, customer, service, address, deduplicated: false };
}

/** Website "Get a Free Estimate" submission. */
export async function captureWebsiteLead(business: Business, values: LeadFormValues) {
  return captureLead({
    business,
    source: "website",
    identity: {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
    },
    address: {
      street: values.street,
      city: values.city,
      state: values.state,
      zip: values.zip,
    },
    serviceSlug: values.serviceSlug,
    preferredDate: values.preferredDate ?? null,
    notes: values.notes ?? null,
  });
}

export async function updateLeadStatus(
  business: Business,
  leadId: string,
  status: LeadStatus,
): Promise<Lead> {
  const store = getStore();
  const existing = await store.getLeadById(business.id, leadId);
  if (!existing) throw new Error(`Lead ${leadId} not found`);
  if (existing.status === status) return existing;

  const lead = await store.updateLead(business.id, leadId, { status });
  const customer = await store.getCustomerById(business.id, lead.customer_id);

  if (customer) {
    await emit("lead.status_changed", {
      business,
      lead,
      customer,
      previousStatus: existing.status,
    });
  }

  return lead;
}

export interface LeadDetail {
  lead: Lead;
  customer: Customer;
  addresses: Address[];
  service: Service | null;
  appointments: Appointment[];
  calls: Call[];
  conversations: Array<{ conversation: Conversation; messageCount: number; lastMessage: string | null }>;
  estimates: Estimate[];
}

/** Everything the lead detail page shows, in one round of queries. */
export async function getLeadDetail(business: Business, leadId: string): Promise<LeadDetail | null> {
  const store = getStore();
  const lead = await store.getLeadById(business.id, leadId);
  if (!lead) return null;

  const customer = await store.getCustomerById(business.id, lead.customer_id);
  if (!customer) return null;

  const [addresses, service, appointments, calls, conversationRows, estimates] = await Promise.all([
    store.listAddressesByCustomer(customer.id),
    lead.service_id ? store.getServiceById(business.id, lead.service_id) : Promise.resolve(null),
    store.listAppointments(business.id, { customerId: customer.id }),
    store.listCalls(business.id, { customerId: customer.id }),
    store.listConversations(business.id, { customerId: customer.id }),
    store.listEstimates(business.id),
  ]);

  const conversations = await Promise.all(
    conversationRows.map(async (conversation) => {
      const messages = await store.listMessages(conversation.id);
      return {
        conversation,
        messageCount: messages.length,
        lastMessage: messages.at(-1)?.body ?? null,
      };
    }),
  );

  return {
    lead,
    customer,
    addresses,
    service,
    appointments,
    calls,
    conversations,
    estimates: estimates.filter((estimate) => estimate.customer_id === customer.id),
  };
}
