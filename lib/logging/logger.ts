import { env } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug")];

export interface LogContext {
  requestId?: string;
  businessId?: string;
  userId?: string;
  provider?: string;
  event?: string;
  success?: boolean;
  latencyMs?: number;
  [key: string]: unknown;
}

/** Keys whose values must never reach a log sink. */
const REDACTED_KEYS = [
  "apikey",
  "api_key",
  "authorization",
  "password",
  "secret",
  "token",
  "servicerolekey",
  "service_role_key",
  "anonkey",
  "signature",
  "cookie",
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle))) {
      out[key] = "[redacted]";
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  if (LEVELS[level] < threshold) return;

  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(redact(context) as LogContext),
  };

  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),

  /** Returns a logger with `base` merged into every call. */
  child(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext) => emit("debug", message, { ...base, ...context }),
      info: (message: string, context?: LogContext) => emit("info", message, { ...base, ...context }),
      warn: (message: string, context?: LogContext) => emit("warn", message, { ...base, ...context }),
      error: (message: string, context?: LogContext) => emit("error", message, { ...base, ...context }),
    };
  },
};

/** Times an async operation and logs latency + outcome exactly once. */
export async function timed<T>(
  message: string,
  context: LogContext,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.info(message, { ...context, success: true, latencyMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    logger.error(message, {
      ...context,
      success: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
