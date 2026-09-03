import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { env, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { normalizeEmail } from "@/lib/utils/phone";
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";
import type { Business, User } from "@/lib/db/types";

/**
 * Authentication.
 *
 * Two backends behind one interface:
 *   - Supabase Auth when SUPABASE_URL + anon key are configured. Passwords are
 *     never handled by this app; the Supabase user is then mapped onto a row in
 *     `users`, which is what carries the business and role.
 *   - A development credential check when Supabase is not configured, so the
 *     dashboard is reachable with `npm run dev` and no accounts to create.
 *
 * Authorization is always ours: `business_id` on the user row scopes every
 * query, and RLS stays enabled in Postgres as defence in depth.
 */

const DEV_EMAIL = "owner@innovationpowerwashing.com";
const DEV_PASSWORD = "powerwash2026";

export interface AuthContext {
  user: User;
  business: Business;
}

/**
 * `AUTH_PROVIDER` wins when set, so a deployment can point the data layer at
 * Supabase while still using the development sign-in (or the reverse).
 */
export function supabaseAuthConfigured(): boolean {
  if (env.AUTH_PROVIDER === "dev") return false;
  if (env.AUTH_PROVIDER === "supabase") return true;
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function devCredentials(): { email: string; password: string } {
  return {
    email: env.DEV_AUTH_EMAIL ?? DEV_EMAIL,
    password: env.DEV_AUTH_PASSWORD ?? DEV_PASSWORD,
  };
}

export type SignInResult = { ok: true; user: User } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const store = getStore();
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: "Enter a valid email address." };

  if (supabaseAuthConfigured()) {
    const client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.auth.signInWithPassword({ email: normalized, password });
    if (error || !data.user) {
      logger.warn("supabase sign-in rejected", { event: "auth.signin", success: false });
      return { ok: false, error: "That email and password did not match." };
    }

    const user =
      (await store.getUserByAuthId(data.user.id)) ?? (await store.getUserByEmail(normalized));
    if (!user) {
      return {
        ok: false,
        error: "That account is not linked to a business yet. Ask an administrator to invite you.",
      };
    }

    await writeSession(user);
    return { ok: true, user };
  }

  // Development credential path.
  const expected = devCredentials();
  const emailMatches = normalized === normalizeEmail(expected.email);
  const passwordMatches = password === expected.password;

  if (!emailMatches || !passwordMatches) {
    logger.warn("dev sign-in rejected", { event: "auth.signin", success: false });
    return { ok: false, error: "That email and password did not match." };
  }

  const user = await store.getUserByEmail(normalized);
  if (!user) return { ok: false, error: "No user record found for that email." };

  await writeSession(user);
  return { ok: true, user };
}

async function writeSession(user: User) {
  await writeSessionCookie({
    userId: user.id,
    businessId: user.business_id,
    email: user.email,
    role: user.role,
  });
  logger.info("user signed in", {
    event: "auth.signin",
    userId: user.id,
    businessId: user.business_id,
    success: true,
  });
}

export async function signOut() {
  await clearSessionCookie();
}

export async function getSession(): Promise<SessionPayload | null> {
  return readSessionCookie();
}

/** Resolves the signed-in user and their business, or null. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;

  const store = getStore();
  const [user, business] = await Promise.all([
    store.getUserById(session.userId),
    store.getBusinessById(session.businessId),
  ]);

  // A session that no longer maps to a live user/business is not a session.
  if (!user || !business || user.business_id !== business.id) return null;

  return { user, business };
}

/** Server-component guard. Redirects to the login page when signed out. */
export async function requireAuth(returnTo = "/dashboard"): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return context;
}

/** Role check for actions only an owner or admin may perform. */
export function canManage(user: User): boolean {
  return user.role === "owner" || user.role === "admin";
}
