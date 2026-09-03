import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import type { OutboundSms, SmsProvider, SmsSendResult } from "@/lib/sms/provider";

/**
 * Constant-time HMAC check shared by the SMS and voice webhooks.
 *
 * When no secret is configured (local development) verification is skipped —
 * that is safe because the mock providers are the only thing posting, and the
 * production path always has a secret. See `docs/SECURITY.md`.
 */
export function verifyHmacSignature(rawBody: string, headers: Headers, secret: string | undefined): boolean {
  if (!secret) return true;

  const provided = headers.get("x-signature") ?? headers.get("x-webhook-signature") ?? "";
  if (!provided) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/** Development transport. Outbound texts are logged and recorded as messages. */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  private counter = 0;

  async send(message: OutboundSms): Promise<SmsSendResult> {
    this.counter += 1;
    const providerMessageId = `mock-sms-${Date.now()}-${this.counter}`;

    logger.info("sms sent", {
      provider: this.name,
      event: "sms.send",
      to: message.to,
      bodyLength: message.body.length,
      success: true,
    });

    return { providerMessageId, status: "sent", provider: this.name };
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    return verifyHmacSignature(rawBody, headers, env.SMS_WEBHOOK_SECRET);
  }
}

/**
 * Twilio transport. `SMS_PROVIDER_API_KEY` holds `ACCOUNT_SID:AUTH_TOKEN`.
 * Not exercised in this build (no account) but the request shape is the
 * documented Messages resource, and every failure surfaces rather than silently
 * dropping the text.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";

  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(credentials: string) {
    const [accountSid, authToken] = credentials.split(":");
    if (!accountSid || !authToken) {
      throw new Error("SMS_PROVIDER_API_KEY must be in the form ACCOUNT_SID:AUTH_TOKEN for the Twilio provider.");
    }
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  async send(message: OutboundSms): Promise<SmsSendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: message.to, From: message.from, Body: message.body }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 300)}`);
      }

      const body = (await response.json()) as { sid?: string; status?: string };
      return {
        providerMessageId: body.sid ?? null,
        status: body.status === "failed" ? "failed" : "sent",
        provider: this.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    return verifyHmacSignature(rawBody, headers, env.SMS_WEBHOOK_SECRET);
  }
}

const globalRef = globalThis as unknown as { __ipwSmsProvider?: SmsProvider };

export function getSmsProvider(): SmsProvider {
  if (!globalRef.__ipwSmsProvider) {
    globalRef.__ipwSmsProvider =
      env.SMS_PROVIDER === "twilio" && env.SMS_PROVIDER_API_KEY
        ? new TwilioSmsProvider(env.SMS_PROVIDER_API_KEY)
        : new MockSmsProvider();
  }
  return globalRef.__ipwSmsProvider;
}

export function setSmsProvider(provider: SmsProvider) {
  globalRef.__ipwSmsProvider = provider;
}
