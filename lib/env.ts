import { z } from "zod";

/**
 * Central environment access. Everything is optional so that the app boots and
 * runs end-to-end with zero credentials (see `docs/ARCHITECTURE.md` — mock mode).
 * Provider selection happens off these values, never off hardcoded vendor code.
 */
/**
 * Values are trimmed before validation. Variables are usually pasted into a
 * hosting dashboard, and a trailing newline on a URL is otherwise enough to
 * fail `.url()`.
 */
const str = () => z.string().trim();
const url = () => z.string().trim().url();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: url().optional(),
  NEXT_PUBLIC_APP_URL: url().optional(),

  // Static hosting. Set only when the site is served from somewhere other than
  // the deployment answering its API calls - see docs/GITHUB_PAGES.md.
  NEXT_PUBLIC_API_BASE_URL: url().optional(),
  CORS_ALLOWED_ORIGINS: str().optional(),

  // Data layer
  DATA_STORE: z.enum(["memory", "supabase"]).optional(),
  DATABASE_URL: str().optional(),
  SUPABASE_URL: url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: url().optional(),
  SUPABASE_ANON_KEY: str().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str().optional(),
  SUPABASE_SERVICE_ROLE_KEY: str().optional(),

  // Providers
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).optional(),
  LLM_API_KEY: str().optional(),
  LLM_MODEL: str().optional(),

  VOICE_PROVIDER: z.enum(["mock", "vapi", "retell", "twilio"]).optional(),
  VOICE_PROVIDER_API_KEY: str().optional(),
  VOICE_PHONE_NUMBER: str().optional(),
  VOICE_WEBHOOK_SECRET: str().optional(),

  SMS_PROVIDER: z.enum(["mock", "twilio"]).optional(),
  SMS_PROVIDER_API_KEY: str().optional(),
  SMS_PHONE_NUMBER: str().optional(),
  SMS_WEBHOOK_SECRET: str().optional(),

  EMAIL_PROVIDER: z.enum(["mock", "resend"]).optional(),
  EMAIL_PROVIDER_API_KEY: str().optional(),
  EMAIL_FROM: str().optional(),

  BOOKING_PROVIDER: z.enum(["internal", "google", "calcom", "calendly"]).optional(),
  BOOKING_PROVIDER_API_KEY: str().optional(),

  // Auth. Defaults to Supabase when its keys are present, `dev` otherwise.
  AUTH_PROVIDER: z.enum(["dev", "supabase"]).optional(),
  DEV_AUTH_EMAIL: str().optional(),
  DEV_AUTH_PASSWORD: str().optional(),
  AUTH_SECRET: str().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(source: Record<string, string | undefined>): {
  env: Env;
  rejected: string[];
} {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { env: parsed.data, rejected: [] };

  /**
   * Degrade per variable, never wholesale.
   *
   * This used to fall back to `envSchema.parse({})`, which discarded *every*
   * variable when any one of them was invalid — so a single malformed URL
   * silently returned a fully configured deployment to mock mode, with no
   * database and no session secret, and the only trace was a console warning.
   * Now only the offending keys are dropped, and their names are reported by
   * /api/health.
   */
  const rejected = [
    ...new Set(parsed.error.issues.map((issue) => String(issue.path[0])).filter(Boolean)),
  ];

  const remaining = { ...source };
  for (const key of rejected) delete remaining[key];

  const retry = envSchema.safeParse(remaining);

  // Never throw at import time - a bad value must not take the whole site down.
  console.warn("[env] ignoring invalid environment values", rejected);

  return { env: retry.success ? retry.data : envSchema.parse({}), rejected };
}

const result = parseEnv(process.env);

export const env: Env = result.env;

/** Names of variables that were set but failed validation. Never their values. */
export const rejectedEnvKeys: string[] = result.rejected;

export const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The Supabase-backed store needs the service-role key: all data access runs
 * server-side under an authorization check we perform ourselves, and RLS stays
 * on as defence in depth for any direct/anon access.
 */
export const hasSupabaseServerCredentials = Boolean(supabaseUrl && env.SUPABASE_SERVICE_ROLE_KEY);

export const dataStoreKind: "memory" | "supabase" =
  env.DATA_STORE ?? (hasSupabaseServerCredentials ? "supabase" : "memory");

export const appUrl =
  env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Origins allowed to call the public API cross-origin. Public hostnames, not
 * secrets. Empty means same-origin only, which is right for a single
 * deployment serving both the site and its API.
 */
export const corsAllowedOrigins: string[] = (env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
