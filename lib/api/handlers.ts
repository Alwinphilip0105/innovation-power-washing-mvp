import { runAssistantTurn } from "@/lib/ai/engine";
import { track } from "@/lib/analytics";
import { getBookingProvider } from "@/lib/booking";
import { BookingError } from "@/lib/booking/availability";
import { getStore } from "@/lib/db";
import {
  errorBody,
  okBody,
  serverErrorBody,
  validationErrorBody,
} from "@/lib/http/responses";
import { logger } from "@/lib/logging/logger";
import { formatInZone } from "@/lib/utils/datetime";
import {
  availabilityQuerySchema,
  chatRequestSchema,
  createAppointmentSchema,
  leadFormSchema,
  voiceDemoSchema,
} from "@/lib/validation/schemas";
import { bookAppointment, describeBookingError } from "@/services/appointments";
import { getCurrentBusiness, resolveService } from "@/services/business";
import { appendMessage, getOrCreateConversation } from "@/services/conversations";
import { captureLead, captureWebsiteLead } from "@/services/leads";
import {
  endDemoCall,
  linkDemoCallToConversation,
  startDemoCall,
  voiceGreeting,
} from "@/services/voice-demo";

/**
 * The public API, independent of how it is reached.
 *
 * These run in two places. On a server they are wrapped by the route handlers
 * in `app/api/*`, which add rate limiting and turn the result into a
 * NextResponse. In the self-contained static build there is no server, so the
 * browser calls exactly these functions instead (see `lib/api/browser.ts`).
 *
 * Keeping the logic here rather than in the route files is what makes those
 * two paths the same product: a fix to booking or the assistant lands on both
 * without anyone remembering to copy it.
 */
export interface ApiResult {
  status: number;
  body: unknown;
}

const ok = (data: unknown): ApiResult => ({ status: 200, body: okBody(data) });
const created = (data: unknown): ApiResult => ({ status: 201, body: okBody(data) });
const failed = (message: string, status: number, extra?: Record<string, unknown>): ApiResult => ({
  status,
  body: errorBody(message, extra),
});

/** Website chat. Same assistant, tools and audit trail as SMS and phone. */
export async function handleChat(input: unknown): Promise<ApiResult> {
  const parsed = chatRequestSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: validationErrorBody(parsed.error) };

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    // A conversation id from the client is only ever used to look up a row
    // scoped to this business; it can never widen access.
    let conversation = parsed.data.conversationId
      ? await store.getConversationById(business.id, parsed.data.conversationId)
      : null;

    if (!conversation) {
      conversation = await getOrCreateConversation(business, {
        channel: "web",
        subject: "Website chat",
      });
    }

    const customer = conversation.customer_id
      ? await store.getCustomerById(business.id, conversation.customer_id)
      : null;

    const result = await runAssistantTurn({
      business,
      conversation,
      customer,
      channel: "web",
      body: parsed.data.message,
    });

    await track(business.id, "chat_message", {
      conversationId: result.conversation.id,
      escalated: result.escalated,
      tools: result.toolsUsed,
    });

    return ok({
      conversationId: result.conversation.id,
      reply: result.reply,
      escalated: result.escalated,
    });
  } catch (error) {
    return { status: 500, body: serverErrorBody(error, { event: "chat.turn" }) };
  }
}

/** Public lead capture: the website "Get a Free Estimate" form. */
export async function handleLead(input: unknown): Promise<ApiResult> {
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: validationErrorBody(parsed.error) };

  // Honeypot: a filled field means a bot. Answer 201 so it learns nothing.
  if (parsed.data.company) {
    logger.warn("lead honeypot triggered", { event: "lead.rejected" });
    return created({ leadId: null, serviceName: null });
  }

  try {
    const business = await getCurrentBusiness();
    const result = await captureWebsiteLead(business, parsed.data);

    await track(business.id, "lead_submitted", {
      source: "website",
      service: result.service?.slug ?? parsed.data.serviceSlug,
      deduplicated: result.deduplicated,
    });

    return created({
      leadId: result.lead.id,
      serviceName: result.service?.name ?? null,
    });
  } catch (error) {
    return { status: 500, body: serverErrorBody(error, { event: "lead.create" }) };
  }
}

/** Public read of real openings. Only returns slots that pass every booking rule. */
export async function handleAvailability(query: {
  serviceId?: string | null;
  serviceSlug?: string | null;
  from?: string | null;
  days?: string | null;
}): Promise<ApiResult> {
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: query.serviceId ?? undefined,
    serviceSlug: query.serviceSlug ?? undefined,
    from: query.from ?? undefined,
    days: query.days ?? undefined,
  });
  if (!parsed.success) return { status: 400, body: validationErrorBody(parsed.error) };

  try {
    const business = await getCurrentBusiness();
    const service = await resolveService(business.id, {
      serviceId: parsed.data.serviceId,
      serviceSlug: parsed.data.serviceSlug,
    });

    if (!service) return failed("We do not offer that service.", 404);

    const days = await getBookingProvider().getAvailability({
      business,
      service,
      fromDate: parsed.data.from,
      days: parsed.data.days,
    });

    return ok({
      timezone: business.timezone,
      service: { slug: service.slug, name: service.name, durationMinutes: service.duration_minutes },
      days: days.map((day) => ({
        date: day.date,
        weekday: day.weekday,
        slots: day.slots.map((slot) => ({ start: slot.start, time: slot.time, label: slot.label })),
      })),
    });
  } catch (error) {
    return { status: 500, body: serverErrorBody(error, { event: "availability.read" }) };
  }
}

/**
 * Public booking. Every rule is re-checked here, so a stale slot from a client
 * that has been sitting open is rejected rather than double-booked.
 */
export async function handleAppointment(input: unknown): Promise<ApiResult> {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: validationErrorBody(parsed.error) };
  const data = parsed.data;

  try {
    const business = await getCurrentBusiness();
    const service = await resolveService(business.id, {
      serviceId: data.serviceId,
      serviceSlug: data.serviceSlug,
    });
    if (!service) return failed("We do not offer that service.", 404);

    const store = getStore();

    // Resolve the customer: either an existing id, or capture a lead which
    // de-duplicates on phone and attaches the address.
    let customer = data.customerId ? await store.getCustomerById(business.id, data.customerId) : null;
    let leadId = data.leadId ?? null;

    if (!customer && data.customer) {
      const captured = await captureLead({
        business,
        source: data.source,
        identity: {
          firstName: data.customer.firstName,
          lastName: data.customer.lastName ?? null,
          phone: data.customer.phone,
          email: data.customer.email ?? null,
        },
        address: data.address,
        serviceId: service.id,
        notes: data.notes ?? null,
        status: "qualified",
      });
      customer = captured.customer;
      leadId = leadId ?? captured.lead.id;
    }

    if (!customer) return failed("We need your contact details to book that.", 400);

    const appointment = await bookAppointment({
      business,
      service,
      customer,
      leadId,
      startTime: data.startTime,
      notes: data.notes ?? null,
      source: data.source,
    });

    await track(business.id, "appointment_created", { source: data.source, service: service.slug });

    return created({
      appointmentId: appointment.id,
      status: appointment.status,
      when: formatInZone(new Date(appointment.start_time), business.timezone, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  } catch (error) {
    // A rejected booking is a normal outcome, not a server fault.
    if (error instanceof BookingError) {
      return failed(describeBookingError(error), 409, { code: error.code });
    }
    return { status: 500, body: serverErrorBody(error, { event: "appointment.create" }) };
  }
}

/** Browser voice demo: one spoken turn, or the end of the call. */
export async function handleVoiceDemo(input: unknown): Promise<ApiResult> {
  const parsed = voiceDemoSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: validationErrorBody(parsed.error) };
  const data = parsed.data;

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    const conversation = data.conversationId
      ? await store.getConversationById(business.id, data.conversationId)
      : null;

    if (data.action === "end") {
      const customer = conversation?.customer_id
        ? await store.getCustomerById(business.id, conversation.customer_id)
        : null;

      const result = await endDemoCall({
        business,
        callId: data.callId,
        conversation,
        customer,
        durationSeconds: data.durationSeconds,
      });

      return ok({
        callId: result.call.id,
        summary: result.summary,
        outcome: result.outcome,
        durationSeconds: result.call.duration,
      });
    }

    let active = conversation;

    if (!active) {
      await startDemoCall({ business, callId: data.callId });
      active = await getOrCreateConversation(business, {
        channel: "phone",
        subject: "Voice demo call",
      });

      // The browser has already spoken the greeting. Recording it keeps the
      // transcript honest and stops the assistant greeting the caller twice.
      await appendMessage({
        conversationId: active.id,
        direction: "outbound",
        sender: "ai",
        body: voiceGreeting(business),
      });

      await track(business.id, "call_received", { direction: "inbound", channel: "phone", demo: true });
    }

    const customer = active.customer_id
      ? await store.getCustomerById(business.id, active.customer_id)
      : null;

    const result = await runAssistantTurn({
      business,
      conversation: active,
      customer,
      channel: "phone",
      body: data.message,
    });

    // The caller only becomes identifiable partway through the call, once the
    // assistant has taken a name and number.
    await linkDemoCallToConversation(business, data.callId, result.conversation);

    return ok({
      conversationId: result.conversation.id,
      reply: result.reply,
      escalated: result.escalated,
      tools: result.toolsUsed,
    });
  } catch (error) {
    return { status: 500, body: serverErrorBody(error, { event: "voice.demo" }) };
  }
}
