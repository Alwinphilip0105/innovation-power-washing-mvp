import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";

export type AnalyticsEventName =
  | "page_view"
  | "cta_click"
  | "lead_submitted"
  | "call_received"
  | "missed_call"
  | "appointment_created"
  | "appointment_completed"
  | "chat_opened"
  | "chat_message";

export interface AnalyticsSink {
  readonly name: string;
  track(name: AnalyticsEventName | string, properties: Record<string, unknown>, businessId: string): Promise<void>;
}

/** Default sink: writes to `analytics_events` so the dashboard can read it back. */
class StoreAnalyticsSink implements AnalyticsSink {
  readonly name = "store";

  async track(name: string, properties: Record<string, unknown>, businessId: string) {
    await getStore().recordAnalyticsEvent({ business_id: businessId, name, properties });
  }
}

const globalRef = globalThis as unknown as { __ipwAnalytics?: AnalyticsSink };

export function getAnalytics(): AnalyticsSink {
  if (!globalRef.__ipwAnalytics) globalRef.__ipwAnalytics = new StoreAnalyticsSink();
  return globalRef.__ipwAnalytics;
}

export function setAnalytics(sink: AnalyticsSink) {
  globalRef.__ipwAnalytics = sink;
}

/**
 * Fire-and-forget. Analytics must never block or fail a customer-facing
 * request, so failures are logged and swallowed.
 */
export async function track(
  businessId: string,
  name: AnalyticsEventName | string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    await getAnalytics().track(name, properties, businessId);
  } catch (error) {
    logger.warn("analytics track failed", {
      businessId,
      event: name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
