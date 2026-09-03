"use server";

import { revalidatePath } from "next/cache";

import { canManage, requireAuth } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { logger } from "@/lib/logging/logger";
import { appointmentStatusSchema, leadUpdateSchema } from "@/lib/validation/schemas";
import { setAppointmentStatus } from "@/services/appointments";
import { updateLeadStatus } from "@/services/leads";
import { getStore } from "@/lib/db";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Dashboard mutations.
 *
 * Every action re-authenticates and re-scopes to the caller's business - a
 * form post can never reach another tenant's row, and ids from the client are
 * only ever used inside a business-scoped query.
 */

export async function updateLeadStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  bootstrap();
  const { business, user } = await requireAuth();

  const leadId = String(formData.get("leadId") ?? "");
  const parsed = leadUpdateSchema.pick({ status: true }).safeParse({ status: formData.get("status") });

  if (!leadId || !parsed.success || !parsed.data.status) {
    return { error: "That status is not valid." };
  }

  const lead = await getStore().getLeadById(business.id, leadId);
  if (!lead) return { error: "That lead no longer exists." };

  await updateLeadStatus(business, leadId, parsed.data.status);
  logger.info("lead status updated", {
    businessId: business.id,
    userId: user.id,
    event: "lead.status_changed",
    leadId,
  });

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");

  return { success: "Status updated." };
}

export async function updateLeadNotesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  bootstrap();
  const { business } = await requireAuth();

  const leadId = String(formData.get("leadId") ?? "");
  const parsed = leadUpdateSchema.pick({ notes: true }).safeParse({ notes: formData.get("notes") });
  if (!leadId || !parsed.success) return { error: "Those notes could not be saved." };

  const lead = await getStore().getLeadById(business.id, leadId);
  if (!lead) return { error: "That lead no longer exists." };

  await getStore().updateLead(business.id, leadId, { notes: parsed.data.notes ?? null });
  revalidatePath(`/dashboard/leads/${leadId}`);

  return { success: "Notes saved." };
}

export async function updateAppointmentStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  bootstrap();
  const { business, user } = await requireAuth();

  if (!canManage(user)) return { error: "You do not have permission to change the schedule." };

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const parsed = appointmentStatusSchema.safeParse(formData.get("status"));
  if (!appointmentId || !parsed.success) return { error: "That status is not valid." };

  const appointment = await getStore().getAppointmentById(business.id, appointmentId);
  if (!appointment) return { error: "That appointment no longer exists." };

  await setAppointmentStatus(business, appointmentId, parsed.data);

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");

  return { success: "Appointment updated." };
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  bootstrap();
  const { business } = await requireAuth();

  const id = String(formData.get("notificationId") ?? "");
  if (id) await getStore().markNotificationRead(business.id, id);

  revalidatePath("/dashboard");
}
