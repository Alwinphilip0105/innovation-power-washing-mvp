export interface OutboundSms {
  to: string;
  from: string;
  body: string;
}

export interface SmsSendResult {
  providerMessageId: string | null;
  status: "queued" | "sent" | "failed";
  provider: string;
}

/** Normalized shape every SMS webhook is mapped into before processing. */
export interface InboundSms {
  eventId: string;
  from: string;
  to: string;
  body: string;
  providerMessageId: string | null;
}

export interface SmsProvider {
  readonly name: string;
  send(message: OutboundSms): Promise<SmsSendResult>;
  /** Verifies the webhook signature. Returning false rejects the request. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
}
