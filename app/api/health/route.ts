import { getAIProvider } from "@/lib/ai";
import { supabaseAuthConfigured } from "@/lib/auth";
import { getBookingProvider } from "@/lib/booking";
import { getStore } from "@/lib/db";
import { corsAllowedOrigins, dataStoreKind, env, isProduction, rejectedEnvKeys } from "@/lib/env";
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
/**
 * The variables a real deployment needs. Reported by presence only, and read
 * straight from process.env rather than the parsed config, so a variable that
 * was set but rejected still shows as present - which is what distinguishes
 * "never configured" from "configured wrongly".
 */
const EXPECTED_PRODUCTION_ENV = [
  "AUTH_SECRET",
  "AUTH_PROVIDER",
  "DATA_STORE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

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
  const envPresent = Object.fromEntries(
    EXPECTED_PRODUCTION_ENV.map((name) => [name, Boolean(process.env[name]?.trim())]),
  );

  /**
   * The names - never the values - of every app-shaped variable this process
   * can actually see. This is what distinguishes a misspelled variable from one
   * that never reached the deployment at all: a typo shows up here under the
   * wrong name, while a wrong project or scope shows up as an empty list.
   */
  const envNamesSeen = Object.keys(process.env)
    .filter((name) => /^(AUTH|SUPA|DATA_STORE|APP_URL|NEXT_PUBLIC|CORS|LLM|AI_|SMS|EMAIL|VOICE|BOOKING)/i.test(name))
    .sort();
  const warnings: string[] = [];

  if (rejectedEnvKeys.length > 0) {
    warnings.push(
      `These environment variables are set but failed validation and are being ignored: ` +
        `${rejectedEnvKeys.join(", ")}. Check for a trailing space or newline, or a value ` +
        `outside the allowed set. Fix the value and redeploy.`,
    );
  }

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
    // Presence, never values. `false` for something you believe you set means
    // it did not reach this deployment - wrong environment scope, or set after
    // the last deploy.
    envConfigured: envPresent,
    envRejected: rejectedEnvKeys,
    envNamesSeen,
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
