import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger } from "@/lib/logging/logger";
import { newId } from "@/lib/utils/id";
import { fieldErrors } from "@/lib/validation/schemas";

/**
 * Uniform API responses.
 *
 * Internal error text never reaches the client - it goes to the structured log
 * with a request id the customer can quote back.
 *
 * Split into body builders and NextResponse wrappers because the same
 * endpoints run in two places: as route handlers on the server, and inside the
 * browser in the self-contained static build. Both produce byte-identical
 * payloads because both go through the builders below.
 */

export function okBody<T>(data: T) {
  return { ok: true as const, data };
}

export function errorBody(message: string, extra?: Record<string, unknown>) {
  return { ok: false as const, error: message, ...extra };
}

export function validationErrorBody(error: ZodError) {
  return {
    ok: false as const,
    error: "Please check the highlighted fields.",
    fields: fieldErrors(error),
  };
}

/** Logs the real failure and returns an opaque body carrying a traceable id. */
export function serverErrorBody(error: unknown, context: Record<string, unknown> = {}) {
  const requestId = newId();
  logger.error("unhandled api error", {
    ...context,
    requestId,
    success: false,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return {
    ok: false as const,
    error: "Something went wrong on our end. Please try again.",
    requestId,
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(okBody(data), { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(okBody(data), { status: 201 });
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(errorBody(message, extra), { status });
}

export function jsonValidationError(error: ZodError) {
  return NextResponse.json(validationErrorBody(error), { status: 400 });
}

export function jsonRateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } },
  );
}

export function jsonUnauthorized() {
  return jsonError("Not authorized.", 401);
}

/** Logs the real failure, returns an opaque 500 with a traceable id. */
export function jsonServerError(error: unknown, context: Record<string, unknown> = {}) {
  return NextResponse.json(serverErrorBody(error, context), { status: 500 });
}

/** Parses a JSON body, returning null when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
