import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

import { LeadNotesForm, LeadStatusForm } from "@/components/dashboard/lead-editor";
import {
  AppointmentStatusBadge,
  CallStatusBadge,
  ConversationStatusBadge,
  EstimateStatusBadge,
} from "@/components/dashboard/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { formatDuration, formatInZone, relativeTime } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { customerName } from "@/services/customers";
import { getLeadDetail } from "@/services/leads";

export const metadata: Metadata = { title: "Lead detail" };

export default async function LeadDetailPage({ params }: PageProps<"/dashboard/leads/[id]">) {
  const { id } = await params;
  const { business } = await requireAuth(`/dashboard/leads/${id}`);

  const detail = await getLeadDetail(business, id);
  if (!detail) notFound();

  const { lead, customer, addresses, service, appointments, calls, conversations, estimates } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/leads"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{customerName(customer)}</h1>
          <p className="text-body-muted">
            {lead.service_requested ?? "General enquiry"} &middot; came in via{" "}
            <span className="capitalize">{lead.source.replace("_", " ")}</span> &middot;{" "}
            {relativeTime(lead.created_at)}
          </p>
        </div>
        {lead.estimated_value != null ? (
          <p className="font-display text-2xl font-extrabold text-ink-900">
            ${lead.estimated_value}
            <span className="block text-xs font-semibold uppercase tracking-wide text-body-muted">
              Estimated value
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-500" aria-hidden="true" />
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="font-semibold text-brand-700 hover:underline">
                    {formatPhone(customer.phone)}
                  </a>
                ) : (
                  <span className="text-body-muted">No phone on file</span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-500" aria-hidden="true" />
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-body-muted">No email on file</span>
                )}
              </p>
              {addresses.length > 0 ? (
                addresses.map((address) => (
                  <p key={address.id} className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                    <span>
                      {address.street}, {address.city}, {address.state} {address.zip}
                    </span>
                  </p>
                ))
              ) : (
                <p className="flex items-center gap-2 text-body-muted">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  No service address captured yet
                </p>
              )}
              {customer.notes ? (
                <p className="rounded-md bg-surface-muted px-3 py-2 text-sm">{customer.notes}</p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Requested service" />
            <CardBody>
              {service ? (
                <>
                  <p className="font-display text-lg font-bold text-ink-900">{service.name}</p>
                  <p className="mt-1 text-body-muted">{service.description}</p>
                  <p className="mt-3 text-sm text-body-muted">
                    {service.starting_price != null && service.pricing_model !== "quote_only"
                      ? `Configured starting price $${service.starting_price}`
                      : "Quote only - no configured price"}{" "}
                    &middot; approx. {service.duration_minutes} minutes on site
                  </p>
                </>
              ) : (
                <p className="text-body-muted">
                  {lead.service_requested ?? "No specific service recorded."}
                </p>
              )}
              {lead.preferred_date ? (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">Customer prefers:</span> {lead.preferred_date}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appointments" description="Everything booked for this customer" />
            <CardBody className="space-y-3">
              {appointments.length === 0 ? (
                <p className="text-body-muted">No appointments booked yet.</p>
              ) : (
                appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5"
                  >
                    <div>
                      <p className="font-semibold text-ink-900">
                        {formatInZone(new Date(appointment.start_time), business.timezone, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {appointment.notes ? (
                        <p className="text-sm text-body-muted">{appointment.notes}</p>
                      ) : null}
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Conversations" description="Chat, SMS and phone threads" />
            <CardBody className="space-y-3">
              {conversations.length === 0 ? (
                <p className="text-body-muted">No conversations yet.</p>
              ) : (
                conversations.map(({ conversation, messageCount, lastMessage }) => (
                  <Link
                    key={conversation.id}
                    href={`/dashboard/conversations/${conversation.id}`}
                    className="block rounded-md border border-line px-3 py-2.5 hover:bg-surface-muted"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold capitalize text-ink-900">
                        {conversation.channel} &middot; {messageCount} messages
                      </p>
                      <ConversationStatusBadge status={conversation.status} />
                    </div>
                    {lastMessage ? (
                      <p className="mt-1 line-clamp-2 text-sm text-body-muted">{lastMessage}</p>
                    ) : null}
                  </Link>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Calls" />
            <CardBody className="space-y-3">
              {calls.length === 0 ? (
                <p className="text-body-muted">No calls recorded.</p>
              ) : (
                calls.map((call) => (
                  <div key={call.id} className="rounded-md border border-line px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink-900">
                        <span className="capitalize">{call.direction}</span> &middot;{" "}
                        {formatPhone(call.phone_number)} &middot; {formatDuration(call.duration)}
                      </p>
                      <CallStatusBadge status={call.status} />
                    </div>
                    {call.summary ? <p className="mt-1 text-sm text-body-muted">{call.summary}</p> : null}
                    {call.transcript ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold text-brand-600">
                          View transcript
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-muted p-3 text-xs">
                          {call.transcript}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Update lead" />
            <CardBody>
              <LeadStatusForm leadId={lead.id} status={lead.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <LeadNotesForm leadId={lead.id} notes={lead.notes} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Estimates" />
            <CardBody className="space-y-3">
              {estimates.length === 0 ? (
                <p className="text-body-muted">No estimate on file.</p>
              ) : (
                estimates.map((estimate) => (
                  <div key={estimate.id} className="rounded-md border border-line px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg font-bold text-ink-900">
                        {estimate.amount != null ? `$${estimate.amount}` : "Not priced"}
                      </p>
                      <EstimateStatusBadge status={estimate.status} />
                    </div>
                    {estimate.notes ? (
                      <p className="mt-1 text-sm text-body-muted">{estimate.notes}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
