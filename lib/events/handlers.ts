import { getStore } from "@/lib/db";
import { on } from "@/lib/events/bus";
import { logger } from "@/lib/logging/logger";
import { notifyOwner } from "@/lib/notifications/service";
import { getSmsProvider } from "@/lib/sms/providers";
import { appUrl } from "@/lib/env";
import { formatInZone } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { customerName } from "@/services/customers";
import { appendMessage, getOrCreateConversation } from "@/services/conversations";
import { ensureLeadForCall } from "@/services/calls";
import type { Business } from "@/lib/db/types";

/**
 * Automations. Each one is a small function on a domain event, kept modular so
 * a workflow can be changed or disabled without touching the code that emits
 * the event. No external workflow tool is required for the MVP.
 */

function dashboardLink(path: string): string {
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

async function sendSms(business: Business, to: string, body: string) {
  const provider = getSmsProvider();
  const from = business.settings.notifications.ownerPhone;

  try {
    const result = await provider.send({ to, from, body });
    return result;
  } catch (error) {
    logger.error("sms send failed", {
      businessId: business.id,
      provider: provider.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Kept on globalThis so dev-mode module reloading cannot register twice.
const globalRef = globalThis as unknown as { __ipwAutomationsRegistered?: boolean };

/** Test seam: lets a suite re-register handlers after clearing the bus. */
export function resetAutomationsRegistration() {
  globalRef.__ipwAutomationsRegistered = false;
}

export function registerAutomations() {
  if (globalRef.__ipwAutomationsRegistered) return;
  globalRef.__ipwAutomationsRegistered = true;

  // --- New lead -> notify the owner -------------------------------------
  on("lead.created", async ({ business, lead, customer }) => {
    await notifyOwner({
      business,
      type: "lead.created",
      title: `New ${lead.source.replace("_", " ")} lead - ${customerName(customer)}`,
      body: `${lead.service_requested ?? "Service enquiry"}${customer.phone ? ` - ${formatPhone(customer.phone)}` : ""}`,
      details: [lead.notes ?? ""].filter(Boolean),
      link: dashboardLink(`/dashboard/leads/${lead.id}`),
    });
  });

  // --- Appointment booked -> confirm the customer, notify the owner ------
  on("appointment.created", async ({ business, appointment, customer }) => {
    const when = formatInZone(new Date(appointment.start_time), business.timezone, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    await notifyOwner({
      business,
      type: "appointment.created",
      title: `Appointment requested - ${customerName(customer)}`,
      body: `${when} (${business.timezone})`,
      details: [appointment.notes ?? ""].filter(Boolean),
      link: dashboardLink("/dashboard/appointments"),
    });

    if (customer.phone) {
      const conversation = await getOrCreateConversation(business, {
        customerId: customer.id,
        leadId: appointment.lead_id,
        channel: "sms",
        subject: "Appointment confirmation",
      });

      const body = `You're on the schedule with ${business.name} for ${when}. Reply here if anything changes.`;
      const result = await sendSms(business, customer.phone, body);

      await appendMessage({
        conversationId: conversation.id,
        direction: "outbound",
        sender: "system",
        body,
        providerMessageId: result?.providerMessageId ?? null,
        status: result ? "sent" : "failed",
      });
    }
  });

  // --- Appointment cancelled -------------------------------------------
  on("appointment.cancelled", async ({ business, appointment, customer }) => {
    await notifyOwner({
      business,
      type: "appointment.cancelled",
      title: `Appointment cancelled - ${customerName(customer)}`,
      body: `Was scheduled for ${formatInZone(new Date(appointment.start_time), business.timezone)}.`,
      link: dashboardLink("/dashboard/appointments"),
    });
  });

  // --- Missed call -> text back and open an AI conversation --------------
  on("call.missed", async ({ business, call, customer }) => {
    const { customer: resolved, leadId } = await ensureLeadForCall(business, call, customer);

    const conversation = await getOrCreateConversation(business, {
      customerId: resolved.id,
      leadId,
      channel: "sms",
      subject: "Missed call follow-up",
    });

    const body = `Sorry we missed your call - this is ${business.settings.ai.assistantName} at ${business.name}. How can we help?`;
    const result = await sendSms(business, call.phone_number, body);

    await appendMessage({
      conversationId: conversation.id,
      direction: "outbound",
      sender: "ai",
      body,
      providerMessageId: result?.providerMessageId ?? null,
      status: result ? "delivered" : "failed",
    });

    await notifyOwner({
      business,
      type: "call.missed",
      title: `Missed call - ${formatPhone(call.phone_number)}`,
      body: "Automated follow-up text sent. The assistant will handle the reply.",
      link: dashboardLink("/dashboard/calls"),
    });
  });

  // --- Estimate requested ----------------------------------------------
  on("estimate.requested", async ({ business, estimate, customer }) => {
    await notifyOwner({
      business,
      type: "estimate.requested",
      title: `Estimate requested - ${customerName(customer)}`,
      body: estimate.notes ?? "No additional detail captured.",
      link: dashboardLink("/dashboard/estimates"),
    });
  });

  // --- Escalation -------------------------------------------------------
  on("escalation.required", async ({ business, conversation, customer, reason, detail }) => {
    await notifyOwner({
      business,
      type: "escalation.required",
      title: `Needs a person - ${customer ? customerName(customer) : "unknown caller"}`,
      body: `Reason: ${reason}${customer?.phone ? ` - ${formatPhone(customer.phone)}` : ""}`,
      details: [detail ?? ""].filter(Boolean),
      link: conversation
        ? dashboardLink(`/dashboard/conversations/${conversation.id}`)
        : dashboardLink("/dashboard"),
    });
  });

  // --- Lead status changes are recorded, not notified --------------------
  on("lead.status_changed", async ({ business, lead, previousStatus }) => {
    await getStore().recordAnalyticsEvent({
      business_id: business.id,
      name: "lead_status_changed",
      properties: { lead_id: lead.id, from: previousStatus, to: lead.status },
    });
  });

  logger.info("automations registered", { event: "bootstrap" });
}
