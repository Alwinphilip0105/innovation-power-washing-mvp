import { z } from "zod";

/**
 * Central environment access. Everything is optional so that the app boots and
 * runs end-to-end with zero credentials (see `docs/ARCHITECTURE.md` — mock mode).
 * Provider selection happens off these values, never off hardcoded vendor code.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Data layer
  DATA_STORE: z.enum(["memory", "supabase"]).optional(),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Providers
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),

  VOICE_PROVIDER: z.enum(["mock", "vapi", "retell", "twilio"]).optional(),
  VOICE_PROVIDER_API_KEY: z.string().optional(),
  VOICE_PHONE_NUMBER: z.string().optional(),
  VOICE_WEBHOOK_SECRET: z.string().optional(),

  SMS_PROVIDER: z.enum(["mock", "twilio"]).optional(),
  SMS_PROVIDER_API_KEY: z.string().optional(),
  SMS_PHONE_NUMBER: z.string().optional(),
  SMS_WEBHOOK_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["mock", "resend"]).optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  BOOKING_PROVIDER: z.enum(["internal", "google", "calcom", "calendly"]).optional(),
  BOOKING_PROVIDER_API_KEY: z.string().optional(),

  // Auth. Defaults to Supabase when its keys are present, `dev` otherwise.
  AUTH_PROVIDER: z.enum(["dev", "supabase"]).optional(),
  DEV_AUTH_EMAIL: z.string().optional(),
  DEV_AUTH_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Never throw at import time — a bad optional value should degrade to mock
  // mode rather than take the whole site down.
  console.warn("[env] invalid environment values, falling back to defaults", parsed.error.flatten().fieldErrors);
}

export const env: Env = parsed.success ? parsed.data : envSchema.parse({});

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

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
