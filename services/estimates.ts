import { getStore } from "@/lib/db";
import { emit } from "@/lib/events/bus";
import type { Business, Customer, Estimate } from "@/lib/db/types";

export interface EstimateRequestInput {
  business: Business;
  customer: Customer;
  leadId?: string | null;
  notes?: string | null;
}

/**
 * Records that a customer wants a written estimate. Deliberately does not set
 * an amount: pricing is a human decision, and the assistant is forbidden from
 * inventing one.
 */
export async function createEstimateRequest({
  business,
  customer,
  leadId,
  notes,
}: EstimateRequestInput): Promise<Estimate> {
  const store = getStore();

  const estimate = await store.createEstimate({
    business_id: business.id,
    customer_id: customer.id,
    lead_id: leadId ?? null,
    status: "requested",
    amount: null,
    notes: notes ?? null,
    sent_at: null,
    accepted_at: null,
  });

  if (leadId) {
    const lead = await store.getLeadById(business.id, leadId);
    if (lead && ["new", "contacted", "qualified"].includes(lead.status)) {
      await store.updateLead(business.id, leadId, { status: "estimate_requested" });
    }
  }

  await emit("estimate.requested", { business, estimate, customer });

  return estimate;
}
