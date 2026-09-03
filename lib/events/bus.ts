import { logger } from "@/lib/logging/logger";
import type { Appointment, Business, Call, Conversation, Customer, Estimate, Lead } from "@/lib/db/types";

/**
 * Domain events. Deliberately a plain in-process emitter: an MVP does not need
 * a queue, and every automation is a function that can be unit tested. The
 * shape is compatible with moving to a durable queue later — handlers already
 * take a serializable payload and must be idempotent-safe.
 */
export interface EventPayloads {
  "lead.created": { business: Business; lead: Lead; customer: Customer };
  "lead.status_changed": { business: Business; lead: Lead; customer: Customer; previousStatus: string };
  "appointment.created": { business: Business; appointment: Appointment; customer: Customer };
  "appointment.cancelled": { business: Business; appointment: Appointment; customer: Customer };
  "call.missed": { business: Business; call: Call; customer: Customer | null };
  "estimate.requested": { business: Business; estimate: Estimate; customer: Customer };
  "conversation.updated": { business: Business; conversation: Conversation };
  "escalation.required": {
    business: Business;
    conversation: Conversation | null;
    customer: Customer | null;
    reason: string;
    detail?: string;
  };
}

export type EventName = keyof EventPayloads;

type Handler<K extends EventName> = (payload: EventPayloads[K]) => Promise<void> | void;

const globalRef = globalThis as unknown as {
  __ipwHandlers?: Map<EventName, Handler<EventName>[]>;
};

function handlers(): Map<EventName, Handler<EventName>[]> {
  if (!globalRef.__ipwHandlers) globalRef.__ipwHandlers = new Map();
  return globalRef.__ipwHandlers;
}

export function on<K extends EventName>(event: K, handler: Handler<K>): void {
  const map = handlers();
  const list = map.get(event) ?? [];
  list.push(handler as Handler<EventName>);
  map.set(event, list);
}

export function clearHandlers(): void {
  handlers().clear();
}

/**
 * Fires every handler for an event. A handler that throws is logged and the
 * others still run — a failing follow-up email must never roll back the lead
 * that caused it.
 */
export async function emit<K extends EventName>(event: K, payload: EventPayloads[K]): Promise<void> {
  const list = handlers().get(event) ?? [];
  const businessId = (payload as { business?: Business }).business?.id;

  logger.info("event emitted", { event, businessId, handlers: list.length });

  await Promise.all(
    list.map(async (handler) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error("event handler failed", {
          event,
          businessId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
