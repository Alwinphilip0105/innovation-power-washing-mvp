import { formatServicePrice } from "@/lib/ai/prompt";
import { deriveState, includesAny, isAffirmative, matchService } from "@/lib/ai/extract";
import type {
  AIProvider,
  AiMessage,
  AiToolCall,
  AiTurnRequest,
  AiTurnResult,
  ExtractedLeadData,
  ToolContext,
} from "@/lib/ai/types";

/**
 * Deterministic assistant used whenever no LLM is configured.
 *
 * It is not a canned script: it drives the same tool pipeline as the real
 * provider, so `check_availability` returns genuine openings, `create_lead`
 * writes a real row, and a booking that conflicts genuinely fails. That makes
 * the demo honest and keeps the tool layer exercised by tests without a network
 * dependency or an API key.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async respond(request: AiTurnRequest): Promise<AiTurnResult> {
    const { business, services } = request.context;
    const state = deriveState(request.messages, business, services);
    const done = new Map(request.toolResults.map((result) => [result.name, result.output]));
    const has = (name: string) => done.has(name);
    const output = <T>(name: string) => done.get(name) as T | undefined;

    // 1. Anything that needs a person wins over everything else.
    if (state.wantsHuman || state.isComplaint) {
      const reason = state.isComplaint ? "complaint" : "customer_requested_human";
      if (!has("notify_owner")) {
        return {
          reply: null,
          toolCalls: [
            call("notify_owner", {
              reason,
              detail: state.lastUserMessage.slice(0, 500),
            }),
          ],
        };
      }

      const escalation = output<{ callback_phone?: string }>("notify_owner");
      return {
        reply: state.isComplaint
          ? `I'm sorry - that's not the experience we want you to have. I've flagged this for the office and someone will call you back directly. You can also reach us at ${escalation?.callback_phone ?? ""}.`.trim()
          : `Of course. I've passed this to the office with your details and someone will call you back. Our number is ${escalation?.callback_phone ?? ""} if you'd rather reach us first.`.trim(),
        toolCalls: [],
        escalation: { reason },
      };
    }

    const offer = findLastOffer(request.messages);
    const selection = offer ? findSelection(request.messages, offer.messageIndex, offer.labels) : null;

    // 2. The customer has picked a time - run the booking chain.
    if (selection) {
      if (!state.phone || !state.firstName) {
        return {
          reply: `Great - ${selection.label} it is. Can I get your name and the best phone number for you?`,
          toolCalls: [],
        };
      }

      if (!has("create_customer")) {
        return {
          reply: null,
          toolCalls: [
            call("create_customer", {
              first_name: state.firstName,
              ...(state.lastName ? { last_name: state.lastName } : {}),
              phone: state.phone,
              ...(state.email ? { email: state.email } : {}),
            }),
            call("check_availability", { service_slug: state.serviceSlug ?? services[0]?.slug }),
          ],
        };
      }

      const customer = output<{ customer_id?: string; error?: string }>("create_customer");
      if (!customer?.customer_id) {
        return {
          reply:
            "I couldn't get that saved - could you give me your phone number again, digits only? I want to make sure the office can reach you.",
          toolCalls: [],
        };
      }

      if (!has("create_lead")) {
        return {
          reply: null,
          toolCalls: [
            call("create_lead", {
              customer_id: customer.customer_id,
              ...(state.serviceSlug ? { service_slug: state.serviceSlug } : {}),
              ...(state.street ? { street: state.street } : {}),
              ...(state.town ? { city: state.town } : {}),
              ...(state.zip ? { zip: state.zip } : {}),
              notes: summarizeRequest(state.lastUserMessage, request.messages),
            }),
          ],
        };
      }

      const lead = output<{ lead_id?: string }>("create_lead");

      if (!has("create_appointment")) {
        const startTime = resolveStartTime(output("check_availability"), selection.label);
        if (!startTime) {
          return {
            reply: `That time has just been taken. ${describeAlternatives(output("check_availability"))}`,
            toolCalls: [],
          };
        }

        return {
          reply: null,
          toolCalls: [
            call("create_appointment", {
              customer_id: customer.customer_id,
              service_slug: state.serviceSlug ?? services[0]?.slug,
              start_time: startTime,
              ...(lead?.lead_id ? { lead_id: lead.lead_id } : {}),
              ...(state.street ? { notes: `Service address: ${state.street}${state.town ? `, ${state.town}` : ""}` } : {}),
            }),
          ],
        };
      }

      const booking = output<{ booked?: boolean; when?: string; error?: string }>("create_appointment");
      if (booking?.booked) {
        return {
          reply: `You're all set for ${booking.when}. The office will call to confirm and we'll text you the morning of. Anything else I can help with?`,
          toolCalls: [],
        };
      }

      return {
        reply: `${booking?.error ?? "I couldn't complete that booking."} I've saved your details and the office will call you back to get you on the schedule.`,
        toolCalls: [],
      };
    }

    // 3. Booking intent, but we still need details before we can offer times.
    if (state.wantsBooking || (offer && isAffirmative(state.lastUserMessage))) {
      if (!state.serviceSlug) {
        return {
          reply: `Happy to get you on the schedule. Which are you looking for - ${listServiceNames(services)}?`,
          toolCalls: [],
        };
      }

      if (!has("check_availability")) {
        return {
          reply: null,
          toolCalls: [call("check_availability", { service_slug: state.serviceSlug })],
        };
      }

      const availability = output<AvailabilityOutput>("check_availability");
      const times = flattenTimes(availability).slice(0, 2);

      if (times.length === 0) {
        return {
          reply:
            "I don't have an opening in the next week or so. I can take your details and have the office call you with the next available date - what's the best number for you?",
          toolCalls: [],
        };
      }

      const askForDetails = !state.phone || !state.firstName;
      return {
        reply: [
          `For ${state.service?.name ?? "that"} I have ${joinTimes(times.map((time) => time.label))}.`,
          askForDetails ? "Which works better, and can I get your name and phone number?" : "Which one works better?",
        ].join(" "),
        toolCalls: [],
      };
    }

    // 4. Pricing question.
    if (includesAny(state.lastUserMessage, PRICE_QUESTIONS)) {
      if (!has("get_services")) {
        return { reply: null, toolCalls: [call("get_services", {})] };
      }

      const service = matchService(state.lastUserMessage, services) ?? state.service;
      if (service) {
        const priced = service.starting_price != null && service.pricing_model !== "quote_only";
        return {
          reply: priced
            ? `${service.name} is ${formatServicePrice(service)}. The final number depends on size and condition, so we confirm it before we start. Want me to check openings?`
            : `${service.name} is priced after we take a look - too much depends on access and condition for me to give you a number I'd stand behind. I can take your details and have the team put an estimate together. Would that work?`,
          toolCalls: [],
        };
      }

      return {
        reply: `Every job is quoted after we see the property — we do not publish a price list. Which service are you thinking about: ${listServiceNames(services)}?`,
        toolCalls: [],
      };
    }

    // 5. Questions the business has already answered - use its own FAQ text.
    const faq = matchFaq(state.lastUserMessage, request.context);
    if (faq) {
      return { reply: `${faq.answer} Anything else I can check for you?`, toolCalls: [] };
    }

    // 6. Service question, or an opening message.
    if (state.service) {
      return {
        reply: `${state.service.description.split(". ")[0]}. ${
          state.service.starting_price != null && state.service.pricing_model !== "quote_only"
            ? `${state.service.name} is ${formatServicePrice(state.service)}.`
            : `${state.service.name} is priced after an estimate.`
        } Would you like me to check what we have open?`,
        toolCalls: [],
      };
    }

    if (request.messages.filter((message) => message.role === "user").length <= 1) {
      return {
        reply: `${business.settings.ai.greeting} We handle ${listServiceNames(services)}.`,
        toolCalls: [],
      };
    }

    return {
      reply:
        "I want to make sure I get that right rather than guess. Tell me a bit more about what you're looking to have cleaned, or I can have someone from the office call you.",
      toolCalls: [],
    };
  }

  async classifyIntent(message: string, context: ToolContext): Promise<string> {
    const state = deriveState([{ role: "user", content: message }], context.business, context.services);
    if (state.wantsHuman) return "human_handoff";
    if (state.isComplaint) return "complaint";
    if (state.wantsBooking) return "booking";
    if (includesAny(message, PRICE_QUESTIONS)) return "pricing";
    if (state.service) return "service_question";
    return "general";
  }

  async extractLeadData(messages: AiMessage[], context: ToolContext): Promise<ExtractedLeadData> {
    const state = deriveState(messages, context.business, context.services);
    return {
      firstName: state.firstName,
      lastName: state.lastName,
      phone: state.phone,
      email: state.email,
      town: state.town,
      street: state.street,
      zip: state.zip,
      serviceSlug: state.serviceSlug,
      notes: state.notes,
    };
  }

  async summarizeConversation(messages: AiMessage[], context: ToolContext): Promise<string> {
    const state = deriveState(messages, context.business, context.services);
    // Two sentences, so the trailing note does not run into the first one.
    const enquiry = [
      state.firstName ? `${state.firstName}${state.lastName ? ` ${state.lastName}` : ""}` : "Caller",
      state.service ? `asked about ${state.service.name}` : "made a general enquiry",
      state.town ? `in ${state.town}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return `${enquiry}. ${state.phone ? "Phone on file." : "No phone captured."}`;
  }
}

// ---------------------------------------------------------------- helpers

const PRICE_QUESTIONS = [
  "how much",
  "price",
  "pricing",
  "cost",
  "costs",
  "quote",
  "estimate",
  "charge",
  "rate",
  "ballpark",
  "$",
];

interface AvailabilityOutput {
  openings?: Array<{ date: string; times: Array<{ start_time: string; label: string }> }>;
  none_available?: boolean;
}

function call(name: string, input: Record<string, unknown>): AiToolCall {
  return { id: `${name}-${Math.random().toString(36).slice(2, 8)}`, name, input };
}

function flattenTimes(availability: AvailabilityOutput | undefined) {
  return (availability?.openings ?? []).flatMap((day) => day.times);
}

function resolveStartTime(availability: unknown, label: string): string | null {
  const times = flattenTimes(availability as AvailabilityOutput | undefined);
  return times.find((time) => time.label === label)?.start_time ?? times[0]?.start_time ?? null;
}

function describeAlternatives(availability: unknown): string {
  const times = flattenTimes(availability as AvailabilityOutput | undefined).slice(0, 2);
  if (times.length === 0) return "Let me take your number and have the office call you with the next opening.";
  return `I can do ${joinTimes(times.map((time) => time.label))} instead - would either of those work?`;
}

function joinTimes(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`;
}

function listServiceNames(services: { name: string; active: boolean }[]): string {
  const names = services.filter((service) => service.active).map((service) => service.name);
  if (names.length <= 1) return names[0] ?? "our services";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * Time offers are echoed back verbatim in the assistant's own message, so the
 * offered set can be recovered from the transcript without extra state.
 */
const OFFER_LABEL_PATTERN =
  /(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2}\s?(?:AM|PM)/g;

function findLastOffer(messages: AiMessage[]): { messageIndex: number; labels: string[] } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== "assistant") continue;
    const labels = messages[index].content.match(OFFER_LABEL_PATTERN);
    if (labels && labels.length > 0) return { messageIndex: index, labels };
  }
  return null;
}

const ORDINALS: Array<[RegExp, number]> = [
  [/\b(first|1st|earlier|earliest)\b/i, 0],
  [/\b(second|2nd|later|latter)\b/i, 1],
  [/\b(third|3rd)\b/i, 2],
];

/** Which offered slot, if any, the customer chose after the offer was made. */
function findSelection(
  messages: AiMessage[],
  offerIndex: number,
  labels: string[],
): { label: string } | null {
  const replies = messages.slice(offerIndex + 1).filter((message) => message.role === "user");
  if (replies.length === 0) return null;

  for (const reply of replies) {
    const text = reply.content;

    const exact = labels.find((label) => text.toLowerCase().includes(label.toLowerCase()));
    if (exact) return { label: exact };

    for (const [pattern, index] of ORDINALS) {
      if (pattern.test(text) && labels[index]) return { label: labels[index] };
    }

    // "the 9am one", "tuesday works", "1:00 please"
    const byFragment = labels.find((label) => {
      const [dayPart, timePart] = label.split(" at ");
      const weekday = dayPart.split(",")[0].toLowerCase();
      const hour = timePart.replace(/:00/, "").replace(/\s/g, "").toLowerCase();
      const lowered = text.toLowerCase().replace(/\s/g, "");
      return lowered.includes(weekday) || lowered.includes(hour) || lowered.includes(timePart.toLowerCase().replace(/\s/g, ""));
    });
    if (byFragment) return { label: byFragment };

    if (isAffirmative(text)) return { label: labels[0] };
  }

  return null;
}

function matchFaq(message: string, context: ToolContext) {
  const lowered = message.toLowerCase();
  if (lowered.length < 8) return null;

  let best: { answer: string; score: number } | null = null;

  for (const faq of context.business.settings.faqs) {
    const keywords = faq.question
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4);

    const score = keywords.filter((word) => lowered.includes(word)).length;
    if (score >= 2 && (!best || score > best.score)) best = { answer: faq.answer, score };
  }

  return best;
}

function summarizeRequest(latest: string, messages: AiMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.content ?? latest;
  return `${first}${first === latest ? "" : ` | ${latest}`}`.slice(0, 500);
}
