import { getAIProvider } from "@/lib/ai";
import { toAiMessages } from "@/lib/ai/engine";
import { getStore } from "@/lib/db";
import { newId } from "@/lib/utils/id";
import { getActiveServices } from "@/services/business";
import { recordVoiceEvent } from "@/services/calls";
import type { Business, Call, Conversation, Customer } from "@/lib/db/types";

/**
 * Browser voice demo.
 *
 * A caller speaks into a web page instead of dialling a number. Everything
 * behind the microphone is the production path: the same assistant, the same
 * tools, the same CRM writes as a real call arriving on the voice webhook. Only
 * the transport is different, so a booking made here is a real booking.
 *
 * The provider name is deliberately distinct from every vendor seat, so demo
 * calls are always separable from real telephony in the calls list.
 */
export const DEMO_VOICE_PROVIDER = "browser-demo";

/**
 * Reserved-for-fiction number (555-01xx). The demo has no real caller id, and
 * inventing a plausible one would attach demo calls to a real customer record.
 */
export const DEMO_CALLER_NUMBER = "+19735550142";

/**
 * How the agent answers the phone.
 *
 * Composed in one place because both the page and the API route need the exact
 * same words: the browser speaks them, and the server writes them into the
 * conversation so the assistant knows it has already greeted the caller.
 */
export function voiceGreeting(business: Business): string {
  const { assistantName } = business.settings.ai;
  return `Thanks for calling ${business.name}, this is ${assistantName}. How can I help you today?`;
}

export interface DemoCallStart {
  business: Business;
  callId: string;
  startedAt?: Date;
}

/** Opens the call record so an abandoned demo still leaves a trace in the CRM. */
export async function startDemoCall({ business, callId, startedAt }: DemoCallStart): Promise<Call> {
  return recordVoiceEvent(business, {
    event: "call.started",
    provider: DEMO_VOICE_PROVIDER,
    callId,
    from: DEMO_CALLER_NUMBER,
    to: business.phone,
    direction: "inbound",
    startedAt: (startedAt ?? new Date()).toISOString(),
  });
}

/**
 * Links the call row to whoever the assistant turned out to be talking to.
 *
 * The caller id is a placeholder, so the customer cannot be resolved up front
 * the way a real inbound call resolves it - it only becomes known once the
 * assistant has captured a name and number mid-call.
 */
export async function linkDemoCallToConversation(
  business: Business,
  callId: string,
  conversation: Conversation,
): Promise<void> {
  const store = getStore();
  const call = await store.getCallByProviderId(business.id, DEMO_VOICE_PROVIDER, callId);
  if (!call) return;

  const customerId = conversation.customer_id ?? call.customer_id;
  const leadId = conversation.lead_id ?? call.lead_id;
  if (customerId === call.customer_id && leadId === call.lead_id) return;

  await store.updateCall(business.id, call.id, { customer_id: customerId, lead_id: leadId });
}

/**
 * What the call achieved, derived from what actually landed in the database.
 *
 * Deliberately not taken from the client or from the assistant's own account of
 * the call: an outcome of "booked" has to mean an appointment row exists.
 */
export async function deriveCallOutcome(
  business: Business,
  conversation: Conversation,
  startedAt: string,
): Promise<string> {
  const store = getStore();

  if (conversation.customer_id) {
    const appointments = await store.listAppointments(business.id, {
      customerId: conversation.customer_id,
      limit: 20,
    });
    if (appointments.some((appointment) => appointment.created_at >= startedAt)) return "booked";
  }

  if (conversation.status === "escalated") return "escalated";
  if (conversation.lead_id) return "lead_captured";
  return "enquiry";
}

export interface DemoCallEnd {
  business: Business;
  callId: string;
  conversation: Conversation | null;
  customer: Customer | null;
  durationSeconds: number;
}

export interface DemoCallEndResult {
  call: Call;
  summary: string | null;
  outcome: string | null;
}

/**
 * Closes the call: transcript, summary and outcome onto the call record, so the
 * demo finishes where a real call finishes - the Calls tab of the dashboard.
 */
export async function endDemoCall({
  business,
  callId,
  conversation,
  customer,
  durationSeconds,
}: DemoCallEnd): Promise<DemoCallEndResult> {
  const store = getStore();
  const existing = await store.getCallByProviderId(business.id, DEMO_VOICE_PROVIDER, callId);
  const startedAt = existing?.started_at ?? new Date(Date.now() - durationSeconds * 1000).toISOString();

  let transcript: string | undefined;
  let summary: string | undefined;
  let outcome: string | undefined;

  if (conversation) {
    const messages = await store.listMessages(conversation.id);
    const aiMessages = toAiMessages(messages);

    transcript =
      aiMessages
        .map((message) => `${message.role === "user" ? "Caller" : "Agent"}: ${message.content}`)
        .join("\n")
        .slice(0, 50_000) || undefined;

    // A summary is a nicety; a failed one must not lose the call record.
    try {
      const services = await getActiveServices(business.id);
      const written = await getAIProvider().summarizeConversation(aiMessages, {
        business,
        services,
        conversation,
        customer,
        channel: "phone",
        now: new Date(),
        requestId: newId(),
      });
      summary = written.slice(0, 5_000) || undefined;
    } catch {
      summary = undefined;
    }

    outcome = await deriveCallOutcome(business, conversation, startedAt);
  }

  await recordVoiceEvent(business, {
    event: "call.completed",
    provider: DEMO_VOICE_PROVIDER,
    callId,
    from: DEMO_CALLER_NUMBER,
    to: business.phone,
    direction: "inbound",
    startedAt,
    endedAt: new Date().toISOString(),
    durationSeconds,
    transcript,
    summary,
    outcome,
  });

  // `recordVoiceEvent` re-resolves the customer from the caller id, which for
  // this demo is a placeholder - so the link has to be re-applied after it.
  if (conversation) await linkDemoCallToConversation(business, callId, conversation);

  const call = await store.getCallByProviderId(business.id, DEMO_VOICE_PROVIDER, callId);
  if (!call) throw new Error(`Demo call ${callId} vanished while being closed`);

  return { call, summary: call.summary, outcome: call.outcome };
}
