import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { getEmailProvider } from "@/lib/notifications/providers";
import type { Business, NotificationType } from "@/lib/db/types";

export interface OwnerNotification {
  business: Business;
  type: NotificationType;
  title: string;
  body: string;
  /** Extra lines appended to the email but not the in-app notification. */
  details?: string[];
  link?: string;
}

/**
 * Fans an operational event out to the owner: an in-app notification row per
 * owner/admin user, plus one email to the configured office address.
 *
 * Email failure is logged, not thrown — a notification is never allowed to fail
 * the customer-facing action that triggered it.
 */
export async function notifyOwner({ business, type, title, body, details = [], link }: OwnerNotification) {
  const store = getStore();

  const users = await store.listUsers(business.id);
  const recipients = users.filter((user) => user.role === "owner" || user.role === "admin");

  await Promise.all(
    (recipients.length > 0 ? recipients : [null]).map((user) =>
      store.createNotification({
        business_id: business.id,
        user_id: user?.id ?? null,
        type,
        title,
        body,
      }),
    ),
  );

  const emailBody = [body, ...details, link ? `\nOpen in the dashboard: ${link}` : ""]
    .filter(Boolean)
    .join("\n");

  try {
    await getEmailProvider().send({
      to: business.settings.notifications.ownerEmail,
      subject: `[${business.name}] ${title}`,
      text: emailBody,
    });
  } catch (error) {
    logger.error("owner email failed", {
      businessId: business.id,
      event: type,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
