import { z } from "zod";

import { APPOINTMENT_STATUSES, CHANNELS, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/db/types";
import { normalizeEmail, normalizePhone } from "@/lib/utils/phone";

/**
 * Every untrusted boundary - public forms, API routes, webhooks and AI tool
 * calls - parses through this module before anything reaches the data layer.
 */

/** Replaces C0/C1 control characters with a space. */
function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0)!;
    out += code < 0x20 || (code >= 0x7f && code <= 0x9f) ? " " : char;
  }
  return out;
}

/** Trim, collapse whitespace, and strip control characters. */
const sanitizedString = (max: number) =>
  z
    .string()
    .transform((value) => stripControlChars(value).replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

export const phoneSchema = z
  .string()
  .min(7, "Enter a valid phone number")
  .max(25)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid US phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const emailSchema = z
  .string()
  .email("Enter a valid email address")
  .max(254)
  .transform((value) => normalizeEmail(value)!);

export const zipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code");

export const usStateSchema = z
  .string()
  .trim()
  .length(2, "Use the two-letter state code")
  .transform((value) => value.toUpperCase());

export const addressSchema = z.object({
  street: sanitizedString(160).pipe(z.string().min(3, "Enter a street address")),
  city: sanitizedString(80).pipe(z.string().min(2, "Enter a city")),
  state: usStateSchema,
  zip: zipSchema,
});

/** Public website "Get a Free Estimate" form. */
export const leadFormSchema = z.object({
  firstName: sanitizedString(60).pipe(z.string().min(1, "Enter your first name")),
  lastName: sanitizedString(60).pipe(z.string().min(1, "Enter your last name")),
  phone: phoneSchema,
  email: emailSchema,
  street: sanitizedString(160).pipe(z.string().min(3, "Enter a street address")),
  city: sanitizedString(80).pipe(z.string().min(2, "Enter a city")),
  state: usStateSchema.optional().default("NJ"),
  zip: zipSchema,
  serviceSlug: sanitizedString(80).pipe(z.string().min(1, "Choose a service")),
  preferredDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  notes: sanitizedString(2000)
    .optional()
    .transform((value) => (value ? value : undefined)),
  /** Honeypot - must stay empty. Bots fill it in. */
  company: z.string().max(0, "Rejected").optional(),
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormValues = z.output<typeof leadFormSchema>;

export const leadUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  notes: sanitizedString(4000).nullable().optional(),
  estimatedValue: z.number().nonnegative().max(1_000_000).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
});

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  serviceSlug: sanitizedString(80).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const createAppointmentSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().nullable().optional(),
    /** Identify the service by id or slug; at least one is required. */
    serviceId: z.string().uuid().optional(),
    serviceSlug: sanitizedString(80).optional(),
    /** UTC ISO instant. */
    startTime: z.string().datetime({ offset: true }),
    notes: sanitizedString(2000).nullable().optional(),
    source: z.enum(LEAD_SOURCES).default("website"),
    customer: z
      .object({
        firstName: sanitizedString(60).pipe(z.string().min(1, "Enter your first name")),
        lastName: sanitizedString(60).optional(),
        phone: phoneSchema,
        email: emailSchema.optional(),
      })
      .optional(),
    address: z
      .object({
        street: sanitizedString(160).pipe(z.string().min(3, "Enter a street address")),
        city: sanitizedString(80).pipe(z.string().min(2, "Enter a town")),
        state: usStateSchema.optional().default("NJ"),
        zip: zipSchema,
      })
      .optional(),
  })
  .refine((value) => Boolean(value.serviceId || value.serviceSlug), {
    message: "Choose a service",
    path: ["serviceSlug"],
  })
  .refine((value) => Boolean(value.customerId || value.customer), {
    message: "Enter your contact details",
    path: ["customer"],
  });

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z
    .string()
    .trim()
    .min(1, "Type a message")
    .max(1500, "That message is too long, please shorten it"),
  channel: z.enum(CHANNELS).default("web"),
});

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

// ------------------------------------------------------------------ webhooks

export const smsWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  from: phoneSchema,
  to: z.string().min(3).max(25),
  body: z.string().max(2000),
  messageId: z.string().min(1).max(200).optional(),
  businessSlug: z.string().max(80).optional(),
});

export const voiceWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  event: z.enum(["call.started", "call.completed", "call.missed", "call.failed"]),
  callId: z.string().min(1).max(200),
  from: phoneSchema,
  to: z.string().min(3).max(25),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  startedAt: z.string().datetime({ offset: true }).optional(),
  endedAt: z.string().datetime({ offset: true }).optional(),
  durationSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 6)
    .optional(),
  transcript: z.string().max(50_000).optional(),
  summary: z.string().max(5_000).optional(),
  outcome: z.string().max(200).optional(),
  recordingUrl: z.string().url().max(2000).optional(),
  businessSlug: z.string().max(80).optional(),
});

export const analyticsEventSchema = z.object({
  name: sanitizedString(80).pipe(z.string().min(1)),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

/** Formats a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
