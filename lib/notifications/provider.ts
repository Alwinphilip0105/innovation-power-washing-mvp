export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  id: string | null;
  provider: string;
  delivered: boolean;
}

/**
 * Notification transport. Email is the only channel wired for the MVP; the
 * interface is deliberately channel-shaped so SMS/push slot in without touching
 * callers (`notifyOwner` already speaks in events, not emails).
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}
