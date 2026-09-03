"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateLeadNotesAction, updateLeadStatusAction, type ActionState } from "@/app/dashboard/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/types";
import { LEAD_STATUS_LABELS } from "@/components/dashboard/status";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function LeadStatusForm({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateLeadStatusAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />

      <Field label="Lead status" htmlFor="lead-status">
        <Select id="lead-status" name="status" defaultValue={status}>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <SaveButton label="Update status" />

      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state.success ? <Alert tone="good">{state.success}</Alert> : null}
    </form>
  );
}

export function LeadNotesForm({ leadId, notes }: { leadId: string; notes: string | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateLeadNotesAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />

      <Field label="Internal notes" htmlFor="lead-notes" hint="Only staff see these.">
        <Textarea id="lead-notes" name="notes" rows={5} defaultValue={notes ?? ""} />
      </Field>

      <SaveButton label="Save notes" />

      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state.success ? <Alert tone="good">{state.success}</Alert> : null}
    </form>
  );
}
