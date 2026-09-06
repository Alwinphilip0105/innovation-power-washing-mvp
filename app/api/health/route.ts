import { getAIProvider } from "@/lib/ai";
import { supabaseAuthConfigured } from "@/lib/auth";
import { getBookingProvider } from "@/lib/booking";
import { getStore } from "@/lib/db";
import { corsAllowedOrigins, dataStoreKind, env, isProduction } from "@/lib/env";
import { jsonOk } from "@/lib/http/responses";
import { getEmailProvider } from "@/lib/notifications/providers";
import { getSmsProvider } from "@/lib/sms/providers";
import { getVoiceProvider } from "@/lib/voice/provider";

/**
 * What is actually wired, and anything misconfigured badly enough to break the
 * product. Reports presence, never values - no secret appears in the response.
 *
 * The `warnings` array exists because the failure it catches is otherwise
 * invisible: a production deployment with no AUTH_SECRET signs cookies with a
 * per-process key, so on a serverless host each instance rejects the others'
 * sessions and users are bounced to the login page at random.
 */
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

  const authSecretConfigured = Boolean(env.AUTH_SECRET);
  const warnings: string[] = [];

  if (isProduction && !authSecretConfigured) {
    warnings.push(
      "AUTH_SECRET is not set. Session cookies are signed with a per-process key, " +
        "so on a multi-instance host users will be signed out when a request lands " +
        "on a different instance. Set AUTH_SECRET and redeploy.",
    );
  }
  if (isProduction && dataStoreKind === "memory") {
    warnings.push(
      "DATA_STORE is in memory. Nothing written survives a restart, and on a " +
        "multi-instance host a submitted lead may never appear in the dashboard. " +
        "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!storeReachable) {
    warnings.push("The data store is not reachable. Check the migrations have been applied.");
  }

  return jsonOk({
    status: warnings.length === 0 && storeReachable ? "ok" : "degraded",
    environment: env.NODE_ENV,
    dataStore: { kind: dataStoreKind, reachable: storeReachable, error: storeError },
    auth: {
      provider: supabaseAuthConfigured() ? "supabase" : "dev",
      secretConfigured: authSecretConfigured,
    },
    // Public origins, never secrets. A static host whose origin is missing here
    // is the reason its chat and booking form fail with no visible error.
    corsAllowedOrigins,
    providers: {
      ai: getAIProvider().name,
      booking: getBookingProvider().name,
      sms: getSmsProvider().name,
      voice: getVoiceProvider().name,
      email: getEmailProvider().name,
    },
    warnings,
  });
}
