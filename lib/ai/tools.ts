import { z } from "zod";

import { getBookingProvider } from "@/lib/booking";
import { BookingError } from "@/lib/booking/availability";
import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { formatPhone, normalizePhone } from "@/lib/utils/phone";
import { formatInZone } from "@/lib/utils/datetime";
import { formatServicePrice } from "@/lib/ai/prompt";
import { bookAppointment, describeBookingError } from "@/services/appointments";
import { escalateConversation } from "@/services/conversations";
import { createEstimateRequest } from "@/services/estimates";
import { captureLead, updateLeadStatus } from "@/services/leads";
import { findOrCreateCustomer } from "@/services/customers";
import { LEAD_STATUSES } from "@/lib/db/types";
import type { ToolContext, ToolDefinition } from "@/lib/ai/types";

/**
 * The assistant's entire capability surface.
 *
 * Contract enforced by `executeTool` below:
 *   AI -> schema validation -> business-scoped context -> service layer -> DB
 *
 * No tool takes a business id, customer id it did not obtain from a lookup, or
 * raw SQL. Nothing here can read or write across tenants, because every call is
 * scoped by `context.business.id`.
 */

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  } catch {
    return { type: "object", properties: {}, additionalProperties: true };
  }
}

function define<TSchema extends z.ZodType>(
  definition: Omit<ToolDefinition<TSchema>, "jsonSchema">,
): ToolDefinition<TSchema> {
  return { ...definition, jsonSchema: jsonSchemaFor(definition.schema) } as ToolDefinition<TSchema>;
}

const empty = z.object({});

// ------------------------------------------------------------------- read

const getBusinessInfo = define({
  name: "get_business_info",
  description:
    "Contact details, address, service area and policies for the business. Use before answering questions about who the company is or where it works.",
  schema: empty,
  mutates: false,
  async execute(_input, { business }: ToolContext) {
    return {
      name: business.name,
      phone: formatPhone(business.phone),
      email: business.email,
      address: business.address,
      timezone: business.timezone,
      tagline: business.settings.tagline,
      licensing: business.settings.licensing ?? null,
      service_area: business.settings.serviceArea,
      policies: business.settings.policies,
    };
  },
});

const getServices = define({
  name: "get_services",
  description:
    "The list of services the business offers with their configured prices. This is the only source of pricing - never state a price that does not come from here.",
  schema: empty,
  mutates: false,
  async execute(_input, { services }: ToolContext) {
    return services
      .filter((service) => service.active)
      .map((service) => ({
        slug: service.slug,
        name: service.name,
        description: service.description,
        price: formatServicePrice(service),
        starting_price: service.starting_price,
        pricing_model: service.pricing_model,
        duration_minutes: service.duration_minutes,
      }));
  },
});

const getBusinessHours = define({
  name: "get_business_hours",
  description: "Opening hours by weekday, in the business's own timezone.",
  schema: empty,
  mutates: false,
  async execute(_input, { business }: ToolContext) {
    return { timezone: business.timezone, hours: business.business_hours };
  },
});

const getCustomer = define({
  name: "get_customer",
  description:
    "Look up an existing customer by phone number. Use before creating a new one so repeat customers are not duplicated.",
  schema: z.object({
    phone: z.string().min(7).max(25).describe("The customer's phone number, any format"),
  }),
  mutates: false,
  async execute(input, { business }: ToolContext) {
    const phone = normalizePhone(input.phone);
    if (!phone) return { found: false, reason: "That does not look like a valid phone number." };

    const customer = await getStore().findCustomerByPhone(business.id, phone);
    if (!customer) return { found: false };

    return {
      found: true,
      customer_id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: formatPhone(customer.phone),
      email: customer.email,
    };
  },
});

const checkAvailability = define({
  name: "check_availability",
  description:
    "Real openings on the schedule for a service. Offer only times this returns - never guess or invent availability.",
  schema: z.object({
    service_slug: z.string().min(1).describe("The slug of the service, from get_services"),
    from_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("First date to search, YYYY-MM-DD. Defaults to today."),
    days: z.number().int().min(1).max(14).optional().describe("How many days to search. Defaults to 7."),
  }),
  mutates: false,
  async execute(input, { business, services, now }: ToolContext) {
    const service = services.find((candidate) => candidate.slug === input.service_slug);
    if (!service) {
      return { error: `Unknown service "${input.service_slug}". Call get_services for valid options.` };
    }

    const days = await getBookingProvider().getAvailability({
      business,
      service,
      fromDate: input.from_date,
      days: input.days ?? 7,
      now,
    });

    const openings = days
      .filter((day) => day.slots.length > 0)
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        times: day.slots.slice(0, 4).map((slot) => ({
          start_time: slot.start,
          label: `${formatInZone(new Date(slot.start), business.timezone, { weekday: "long", month: "short", day: "numeric" })} at ${slot.label}`,
        })),
      }));

    return {
      service: service.name,
      duration_minutes: service.duration_minutes,
      timezone: business.timezone,
      openings,
      none_available: openings.length === 0,
    };
  },
});

// ------------------------------------------------------------------ write

const createCustomer = define({
  name: "create_customer",
  description:
    "Create a customer record, or return the existing one if the phone number is already on file. Call this before create_lead or create_appointment.",
  schema: z.object({
    first_name: z.string().min(1).max(60),
    last_name: z.string().max(60).optional(),
    phone: z.string().min(7).max(25),
    email: z.string().max(254).optional(),
  }),
  mutates: true,
  async execute(input, { business }: ToolContext) {
    const phone = normalizePhone(input.phone);
    if (!phone) return { error: "That phone number is not valid. Ask the customer to repeat it." };

    const { customer, created } = await findOrCreateCustomer(business.id, {
      firstName: input.first_name,
      lastName: input.last_name ?? null,
      phone,
      email: input.email ?? null,
    });

    return { customer_id: customer.id, created, name: customer.first_name };
  },
});

const createLead = define({
  name: "create_lead",
  description: "Record the customer's enquiry so the office can follow up. Call once per enquiry.",
  schema: z.object({
    customer_id: z.string().min(1).describe("From create_customer or get_customer"),
    service_slug: z.string().min(1).optional(),
    street: z.string().max(160).optional(),
    city: z.string().max(80).optional(),
    zip: z.string().max(10).optional(),
    notes: z.string().max(2000).optional().describe("What the customer asked for, in your own words"),
  }),
  mutates: true,
  async execute(input, { business, channel }: ToolContext) {
    const customer = await getStore().getCustomerById(business.id, input.customer_id);
    if (!customer) return { error: "That customer id is not valid. Call create_customer first." };

    const hasAddress = Boolean(input.street && input.city && input.zip);

    const result = await captureLead({
      business,
      source: channel === "web" ? "web_chat" : channel === "sms" ? "sms" : "phone",
      identity: {
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        email: customer.email,
      },
      address: hasAddress
        ? { street: input.street!, city: input.city!, state: "NJ", zip: input.zip! }
        : undefined,
      serviceSlug: input.service_slug ?? null,
      notes: input.notes ?? null,
      status: "qualified",
    });

    return { lead_id: result.lead.id, status: result.lead.status, deduplicated: result.deduplicated };
  },
});

const updateLead = define({
  name: "update_lead",
  description: "Move an existing lead to a new status, for example after the customer books or declines.",
  schema: z.object({
    lead_id: z.string().min(1),
    status: z.enum(LEAD_STATUSES),
  }),
  mutates: true,
  async execute(input, { business }: ToolContext) {
    const lead = await updateLeadStatus(business, input.lead_id, input.status);
    return { lead_id: lead.id, status: lead.status };
  },
});

const createAppointment = define({
  name: "create_appointment",
  description:
    "Book a slot returned by check_availability. Confirm the service, date and time with the customer first. If this returns an error, tell the customer the booking did not go through.",
  schema: z.object({
    customer_id: z.string().min(1),
    service_slug: z.string().min(1),
    start_time: z.string().min(10).describe("The exact start_time value from check_availability"),
    lead_id: z.string().optional(),
    notes: z.string().max(2000).optional(),
  }),
  mutates: true,
  async execute(input, { business, services, channel, now }: ToolContext) {
    const service = services.find((candidate) => candidate.slug === input.service_slug);
    if (!service) return { error: `Unknown service "${input.service_slug}".` };

    const customer = await getStore().getCustomerById(business.id, input.customer_id);
    if (!customer) return { error: "That customer id is not valid. Call create_customer first." };

    try {
      const appointment = await bookAppointment({
        business,
        service,
        customer,
        leadId: input.lead_id ?? null,
        startTime: new Date(input.start_time).toISOString(),
        notes: input.notes ?? `Booked by the ${channel} assistant.`,
        source: channel === "web" ? "web_chat" : channel === "sms" ? "sms" : "phone",
        now,
      });

      return {
        booked: true,
        appointment_id: appointment.id,
        when: formatInZone(new Date(appointment.start_time), business.timezone, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        status: appointment.status,
      };
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
      return { booked: false, error: describeBookingError(error), code: error.code };
    }
  },
});

const cancelAppointmentTool = define({
  name: "cancel_appointment",
  description: "Cancel an existing appointment at the customer's request.",
  schema: z.object({
    appointment_id: z.string().min(1),
    reason: z.string().max(500).optional(),
  }),
  mutates: true,
  async execute(input, { business }: ToolContext) {
    const store = getStore();
    const appointment = await store.getAppointmentById(business.id, input.appointment_id);
    if (!appointment) return { error: "That appointment could not be found." };

    const { cancelAppointment } = await import("@/services/appointments");
    const cancelled = await cancelAppointment(business, appointment.id, input.reason);
    return { cancelled: true, appointment_id: cancelled.id };
  },
});

const createEstimateRequestTool = define({
  name: "create_estimate_request",
  description:
    "Ask the team for a written estimate. Use this whenever a price is not configured for what the customer wants - never make a number up.",
  schema: z.object({
    customer_id: z.string().min(1),
    lead_id: z.string().optional(),
    notes: z.string().max(2000).describe("What needs pricing, including size and condition details"),
  }),
  mutates: true,
  async execute(input, { business }: ToolContext) {
    const customer = await getStore().getCustomerById(business.id, input.customer_id);
    if (!customer) return { error: "That customer id is not valid." };

    const estimate = await createEstimateRequest({
      business,
      customer,
      leadId: input.lead_id ?? null,
      notes: input.notes,
    });

    return { estimate_id: estimate.id, status: estimate.status };
  },
});

const notifyOwnerTool = define({
  name: "notify_owner",
  description:
    "Hand the conversation to a person. Use for complaints, disputes, unsafe situations, anything outside the service list, or whenever the customer asks for a human.",
  schema: z.object({
    reason: z.string().min(1).max(200),
    detail: z.string().max(2000).optional(),
  }),
  mutates: true,
  async execute(input, { business, conversation }: ToolContext) {
    await escalateConversation(business, conversation, input.reason, input.detail);
    return { escalated: true, callback_phone: formatPhone(business.settings.ai.escalationPhone) };
  },
});

export const TOOLS: ToolDefinition[] = [
  getBusinessInfo,
  getServices,
  getBusinessHours,
  getCustomer,
  checkAvailability,
  createCustomer,
  createLead,
  updateLead,
  createAppointment,
  cancelAppointmentTool,
  createEstimateRequestTool,
  notifyOwnerTool,
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export interface ToolExecution {
  name: string;
  ok: boolean;
  output: unknown;
}

/**
 * Runs one model-requested tool call. This is the authorization boundary:
 * unknown tools are refused, input is schema-validated, execution is scoped to
 * the caller's business, and every attempt is written to `ai_actions`.
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  context: ToolContext,
): Promise<ToolExecution> {
  const store = getStore();
  const tool = TOOLS_BY_NAME.get(name);
  const startedAt = Date.now();

  const audit = async (ok: boolean, output: unknown, error?: string) => {
    await store.createAiAction({
      business_id: context.business.id,
      customer_id: context.customer?.id ?? null,
      conversation_id: context.conversation.id,
      action_type: name,
      input: rawInput,
      output,
      success: ok,
      error: error ?? null,
    });
  };

  if (!tool) {
    logger.warn("unknown tool requested", {
      businessId: context.business.id,
      requestId: context.requestId,
      event: "ai.tool",
      tool: name,
    });
    const output = { error: `Unknown tool "${name}".` };
    await audit(false, output, "unknown_tool");
    return { name, ok: false, output };
  }

  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    const output = {
      error: "Those arguments are not valid.",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`),
    };
    logger.warn("tool input rejected", {
      businessId: context.business.id,
      requestId: context.requestId,
      event: "ai.tool",
      tool: name,
      success: false,
    });
    await audit(false, output, "invalid_input");
    return { name, ok: false, output };
  }

  try {
    const output = await tool.execute(parsed.data, context);
    logger.info("tool executed", {
      businessId: context.business.id,
      requestId: context.requestId,
      event: "ai.tool",
      tool: name,
      mutates: tool.mutates,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    await audit(true, output);
    return { name, ok: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("tool failed", {
      businessId: context.business.id,
      requestId: context.requestId,
      event: "ai.tool",
      tool: name,
      success: false,
      latencyMs: Date.now() - startedAt,
      error: message,
    });
    await audit(false, { error: "That step failed." }, message);
    // Internal detail stays in the log; the model only learns it failed.
    return { name, ok: false, output: { error: "That step could not be completed." } };
  }
}
