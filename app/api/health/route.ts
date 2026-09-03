import { getAIProvider } from "@/lib/ai";
import { getBookingProvider } from "@/lib/booking";
import { getStore } from "@/lib/db";
import { dataStoreKind, env } from "@/lib/env";
import { jsonOk } from "@/lib/http/responses";
import { getEmailProvider } from "@/lib/notifications/providers";
import { getSmsProvider } from "@/lib/sms/providers";
import { getVoiceProvider } from "@/lib/voice/provider";

/** Which providers are actually wired. Useful in a deploy check; leaks no secrets. */
export async function GET() {
  const store = getStore();

  let storeReachable = true;
  let storeError: string | null = null;
  try {
    await store.ready();
    await store.listBusinesses();
  } catch (error) {
    storeReachable = false;
    storeError = error instanceof Error ? error.message : "unknown error";
  }

  return jsonOk({
    status: storeReachable ? "ok" : "degraded",
    environment: env.NODE_ENV,
    dataStore: { kind: dataStoreKind, reachable: storeReachable, error: storeError },
    providers: {
      ai: getAIProvider().name,
      booking: getBookingProvider().name,
      sms: getSmsProvider().name,
      voice: getVoiceProvider().name,
      email: getEmailProvider().name,
    },
  });
}
