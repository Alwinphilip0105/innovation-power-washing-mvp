"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateAppointmentStatusAction, type ActionState } from "@/app/dashboard/actions";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/db/types";

const LABELS: Record<AppointmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? "Saving" : "Apply"}
    </button>
  );
}

export function AppointmentStatusForm({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateAppointmentStatusAction, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <label htmlFor={`status-${appointmentId}`} className="sr-only">
        Appointment status
      </label>
      <select
        id={`status-${appointmentId}`}
        name="status"
        defaultValue={status}
        className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-xs"
      >
        {APPOINTMENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {LABELS[value]}
          </option>
        ))}
      </select>
      <Submit />
      {state.error ? (
        <span role="alert" className="text-xs font-semibold text-bad">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
