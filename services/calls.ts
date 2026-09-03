import { getStore } from "@/lib/db";
import { emit } from "@/lib/events/bus";
import { logger } from "@/lib/logging/logger";
import { formatPhone } from "@/lib/utils/phone";
import { captureLead } from "@/services/leads";
import type { Business, Call, CallStatus, Customer } from "@/lib/db/types";

export interface VoiceEvent {
  event: "call.started" | "call.completed" | "call.missed" | "call.failed";
  provider: string;
  callId: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  outcome?: string;
  recordingUrl?: string;
}

const STATUS_BY_EVENT: Record<VoiceEvent["event"], CallStatus> = {
  "call.started": "in_progress",
  "call.completed": "completed",
  "call.missed": "missed",
  "call.failed": "failed",
};

/**
 * Applies a normalized telephony event to the CRM.
 *
 * Upserts on `(provider, provider_call_id)` so a provider that retries a
 * webhook updates the same call row rather than creating a second one. The
 * route-level idempotency check catches exact duplicates; this catches the
 * legitimate started -> completed sequence.
 */
export async function recordVoiceEvent(business: Business, event: VoiceEvent): Promise<Call> {
  const store = getStore();

  const customerPhone = event.direction === "inbound" ? event.from : event.to;
  const customer = await store.findCustomerByPhone(business.id, customerPhone);

  const existing = await store.getCallByProviderId(business.id, event.provider, event.callId);
  const status = STATUS_BY_EVENT[event.event];

  const patch = {
    business_id: business.id,
    customer_id: customer?.id ?? null,
    lead_id: existing?.lead_id ?? null,
    provider: event.provider,
    provider_call_id: event.callId,
    direction: event.direction,
    phone_number: customerPhone,
    started_at: event.startedAt ?? existing?.started_at ?? new Date().toISOString(),
    ended_at: event.endedAt ?? existing?.ended_at ?? null,
    duration: event.durationSeconds ?? existing?.duration ?? null,
    status,
    transcript: event.transcript ?? existing?.transcript ?? null,
    summary: event.summary ?? existing?.summary ?? null,
    outcome: event.outcome ?? existing?.outcome ?? null,
    recording_url: event.recordingUrl ?? existing?.recording_url ?? null,
  };

  const call = existing
    ? await store.updateCall(business.id, existing.id, patch)
    : await store.createCall(patch);

  logger.info("call recorded", {
    businessId: business.id,
    event: event.event,
    provider: event.provider,
    callId: call.id,
    status,
  });

  if (status === "missed" && event.direction === "inbound") {
    await emit("call.missed", { business, call, customer });
  }

  return call;
}

/**
 * Ensures a missed inbound call has a customer and an open lead attached, so
 * the follow-up SMS lands in a real CRM thread rather than nowhere.
 */
export async function ensureLeadForCall(
  business: Business,
  call: Call,
  existingCustomer: Customer | null,
): Promise<{ customer: Customer; leadId: string }> {
  const result = await captureLead({
    business,
    source: call.direction === "inbound" ? "phone" : "manual",
    identity: {
      firstName: existingCustomer?.first_name ?? "Caller",
      lastName: existingCustomer?.last_name ?? null,
      phone: call.phone_number,
      email: existingCustomer?.email ?? null,
    },
    serviceRequested: null,
    notes: `Missed call from ${formatPhone(call.phone_number)}. Automated follow-up text sent.`,
    status: "contacted",
  });

  await getStore().updateCall(business.id, call.id, {
    customer_id: result.customer.id,
    lead_id: result.lead.id,
  });

  return { customer: result.customer, leadId: result.lead.id };
}
