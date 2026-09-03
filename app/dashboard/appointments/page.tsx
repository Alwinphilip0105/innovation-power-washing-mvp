import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentStatusForm } from "@/components/dashboard/appointment-status-form";
import { AppointmentStatusBadge } from "@/components/dashboard/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { formatInZone } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { withContext, type AppointmentWithContext } from "@/services/appointments";
import { customerName } from "@/services/customers";

export const metadata: Metadata = { title: "Appointments" };

function Rows({
  rows,
  timezone,
  emptyMessage,
}: {
  rows: AppointmentWithContext[];
  timezone: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) return <EmptyRow colSpan={5}>{emptyMessage}</EmptyRow>;

  return (
    <>
      {rows.map(({ appointment, customer, service }) => (
        <tr key={appointment.id} className="hover:bg-surface-muted">
          <Td className="whitespace-nowrap">
            <span className="font-semibold text-ink-900">
              {formatInZone(new Date(appointment.start_time), timezone, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="block text-sm text-body-muted">
              {formatInZone(new Date(appointment.start_time), timezone, {
                hour: "numeric",
                minute: "2-digit",
              })}
              {" - "}
              {formatInZone(new Date(appointment.end_time), timezone, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </Td>
          <Td>
            {customer ? (
              appointment.lead_id ? (
                <Link
                  href={`/dashboard/leads/${appointment.lead_id}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {customerName(customer)}
                </Link>
              ) : (
                <span className="font-semibold">{customerName(customer)}</span>
              )
            ) : (
              "Unknown"
            )}
            {customer?.phone ? (
              <span className="block text-xs text-body-muted">{formatPhone(customer.phone)}</span>
            ) : null}
          </Td>
          <Td>
            {service?.name ?? "-"}
            {appointment.notes ? (
              <span className="block text-xs text-body-muted">{appointment.notes}</span>
            ) : null}
          </Td>
          <Td>
            <AppointmentStatusBadge status={appointment.status} />
            <span className="mt-0.5 block text-xs capitalize text-body-muted">
              booked via {appointment.source.replace("_", " ")}
            </span>
          </Td>
          <Td>
            <AppointmentStatusForm appointmentId={appointment.id} status={appointment.status} />
          </Td>
        </tr>
      ))}
    </>
  );
}

export default async function AppointmentsPage() {
  const { business } = await requireAuth("/dashboard/appointments");
  const store = getStore();
  const now = new Date().toISOString();

  const [upcomingRaw, pastRaw] = await Promise.all([
    store.listAppointments(business.id, { from: now, limit: 100 }),
    store.listAppointments(business.id, { to: now, limit: 50 }),
  ]);

  const [upcoming, past] = await Promise.all([
    withContext(business, upcomingRaw),
    withContext(business, pastRaw.reverse()),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Appointments</h1>
        <p className="text-body-muted">
          All times in {business.timezone.replace("_", " ")}. Confirming an appointment does not text
          the customer again - they were already confirmed at booking.
        </p>
      </div>

      <Card>
        <CardHeader title="Upcoming" description={`${upcoming.length} scheduled`} />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Customer</Th>
                <Th>Service</Th>
                <Th>Status</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              <Rows rows={upcoming} timezone={business.timezone} emptyMessage="Nothing on the books." />
            </tbody>
          </Table>
        </TableScroller>
      </Card>

      <Card>
        <CardHeader title="Past" description="Most recent first" />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Customer</Th>
                <Th>Service</Th>
                <Th>Status</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              <Rows rows={past} timezone={business.timezone} emptyMessage="No past appointments yet." />
            </tbody>
          </Table>
        </TableScroller>
      </Card>
    </div>
  );
}
