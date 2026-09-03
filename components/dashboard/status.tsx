import { Badge, type BadgeTone } from "@/components/ui/badge";
import type {
  AppointmentStatus,
  CallStatus,
  ConversationStatus,
  EstimateStatus,
  LeadStatus,
} from "@/lib/db/types";

const LEAD_TONES: Record<LeadStatus, BadgeTone> = {
  new: "info",
  contacted: "info",
  qualified: "info",
  estimate_requested: "warn",
  estimate_sent: "warn",
  booked: "good",
  completed: "good",
  lost: "neutral",
};

const LEAD_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  estimate_requested: "Estimate requested",
  estimate_sent: "Estimate sent",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_TONES[status]}>{LEAD_LABELS[status]}</Badge>;
}

const APPOINTMENT_TONES: Record<AppointmentStatus, BadgeTone> = {
  requested: "warn",
  confirmed: "good",
  cancelled: "bad",
  completed: "neutral",
  no_show: "bad",
};

const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  requested: "Needs confirming",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={APPOINTMENT_TONES[status]}>{APPOINTMENT_LABELS[status]}</Badge>;
}

const CALL_TONES: Record<CallStatus, BadgeTone> = {
  in_progress: "info",
  completed: "good",
  missed: "bad",
  failed: "bad",
  voicemail: "warn",
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const labels: Record<CallStatus, string> = {
    in_progress: "In progress",
    completed: "Completed",
    missed: "Missed",
    failed: "Failed",
    voicemail: "Voicemail",
  };
  return <Badge tone={CALL_TONES[status]}>{labels[status]}</Badge>;
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const tones: Record<ConversationStatus, BadgeTone> = {
    open: "info",
    escalated: "warn",
    closed: "neutral",
  };
  const labels: Record<ConversationStatus, string> = {
    open: "Open",
    escalated: "Needs a person",
    closed: "Closed",
  };
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  const tones: Record<EstimateStatus, BadgeTone> = {
    requested: "warn",
    draft: "neutral",
    sent: "info",
    accepted: "good",
    declined: "bad",
    expired: "neutral",
  };
  const labels: Record<EstimateStatus, string> = {
    requested: "Requested",
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
  };
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

export const LEAD_STATUS_LABELS = LEAD_LABELS;
