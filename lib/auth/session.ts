import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env, isProduction } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

export const SESSION_COOKIE = "ipw_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionPayload {
  userId: string;
  businessId: string;
  email: string;
  role: string;
  exp: number;
}

const globalRef = globalThis as unknown as { __ipwAuthSecret?: string };

function secret(): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;

  if (!globalRef.__ipwAuthSecret) {
    // No configured secret: use a per-process random one rather than a
    // predictable default. Sessions do not survive a restart, which is the
    // correct failure mode for a missing secret.
    globalRef.__ipwAuthSecret = randomBytes(32).toString("hex");
    logger.warn("AUTH_SECRET is not set - sessions will not survive a restart", {
      event: "auth.config",
      production: isProduction,
    });
  }
  return globalRef.__ipwAuthSecret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function serializeSession(payload: SessionPayload): string {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function parseSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function writeSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const store = await cookies();
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };

  store.set(SESSION_COOKIE, serializeSession(full), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}
