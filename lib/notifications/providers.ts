import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { newId } from "@/lib/utils/id";
import type { EmailMessage, EmailProvider, EmailResult } from "@/lib/notifications/provider";

export interface OutboxEntry extends EmailMessage {
  id: string;
  sentAt: string;
  provider: string;
}

const OUTBOX_LIMIT = 50;
const globalRef = globalThis as unknown as { __ipwEmailOutbox?: OutboxEntry[] };

function outbox(): OutboxEntry[] {
  if (!globalRef.__ipwEmailOutbox) globalRef.__ipwEmailOutbox = [];
  return globalRef.__ipwEmailOutbox;
}

/** Everything the mock provider "sent", newest first. Surfaced in the dashboard. */
export function getEmailOutbox(): OutboxEntry[] {
  return [...outbox()].reverse();
}

export function clearEmailOutbox() {
  outbox().length = 0;
}

/** Development transport: records the message and logs a one-line summary. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";

  async send(message: EmailMessage): Promise<EmailResult> {
    const entry: OutboxEntry = {
      ...message,
      id: newId(),
      sentAt: new Date().toISOString(),
      provider: this.name,
    };

    const box = outbox();
    box.push(entry);
    if (box.length > OUTBOX_LIMIT) box.splice(0, box.length - OUTBOX_LIMIT);

    logger.info("email sent", {
      provider: this.name,
      event: "email.send",
      to: message.to,
      subject: message.subject,
      success: true,
    });

    return { id: entry.id, provider: this.name, delivered: true };
  }
}

/** Production transport. Resend's send endpoint is a single JSON POST. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
      }

      const body = (await response.json()) as { id?: string };
      logger.info("email sent", {
        provider: this.name,
        event: "email.send",
        to: message.to,
        success: true,
      });
      return { id: body.id ?? null, provider: this.name, delivered: true };
    } finally {
      clearTimeout(timeout);
    }
  }
}

const providerRef = globalThis as unknown as { __ipwEmailProvider?: EmailProvider };

export function getEmailProvider(): EmailProvider {
  if (!providerRef.__ipwEmailProvider) {
    if (env.EMAIL_PROVIDER === "resend" && env.EMAIL_PROVIDER_API_KEY) {
      providerRef.__ipwEmailProvider = new ResendEmailProvider(
        env.EMAIL_PROVIDER_API_KEY,
        env.EMAIL_FROM ?? "notifications@example.com",
      );
    } else {
      providerRef.__ipwEmailProvider = new MockEmailProvider();
    }
  }
  return providerRef.__ipwEmailProvider;
}

export function setEmailProvider(provider: EmailProvider) {
  providerRef.__ipwEmailProvider = provider;
}
