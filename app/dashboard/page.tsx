import Link from "next/link";
import { CalendarDays, PhoneMissed, TrendingUp, UserPlus, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { AppointmentStatusBadge, CallStatusBadge, LeadStatusBadge } from "@/components/dashboard/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { formatDuration, formatInZone, relativeTime } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { customerName } from "@/services/customers";
import { getDashboardData } from "@/services/dashboard";

export default async function DashboardPage() {
  const { business } = await requireAuth();
  const { metrics, recentLeads, upcomingAppointments, recentCalls, notifications } =
    await getDashboardData(business);

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Today at a glance</h1>
        <p className="text-body-muted">
          {formatInZone(new Date(), business.timezone, { dateStyle: "full" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="New leads"
          value={metrics.newLeads}
          detail="Waiting on a first touch"
          icon={UserPlus}
          href="/dashboard/leads?status=new"
          tone={metrics.newLeads > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Leads this month"
          value={metrics.leadsThisMonth}
          detail={`${currency.format(metrics.pipelineValue)} in open pipeline`}
          icon={Users}
          href="/dashboard/leads"
        />
        <StatCard
          label="Upcoming jobs"
          value={metrics.upcomingAppointments}
          detail="Requested or confirmed"
          icon={CalendarDays}
          href="/dashboard/appointments"
        />
        <StatCard
          label="Missed calls"
          value={metrics.missedCalls}
          detail="Last 30 days"
          icon={PhoneMissed}
          href="/dashboard/calls"
          tone={metrics.missedCalls > 0 ? "alert" : "good"}
        />
        <StatCard
          label="Conversion rate"
          value={`${metrics.conversionRate}%`}
          detail="Leads booked this month"
          icon={TrendingUp}
          tone="good"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent leads"
            description="Newest first"
            action={
              <Link href="/dashboard/leads" className="text-sm font-semibold text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          <TableScroller>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Service</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Received</Th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <EmptyRow colSpan={5}>No leads yet.</EmptyRow>
                ) : (
                  recentLeads.map(({ lead, customer }) => (
                    <tr key={lead.id} className="hover:bg-surface-muted">
                      <Td>
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {customer ? customerName(customer) : "Unknown"}
                        </Link>
                        {customer?.phone ? (
                          <span className="block text-xs text-body-muted">{formatPhone(customer.phone)}</span>
                        ) : null}
                      </Td>
                      <Td>{lead.service_requested ?? "General enquiry"}</Td>
                      <Td className="capitalize">{lead.source.replace("_", " ")}</Td>
                      <Td>
                        <LeadStatusBadge status={lead.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-body-muted">{relativeTime(lead.created_at)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableScroller>
        </Card>

        <Card>
          <CardHeader title="Needs your attention" description="Unread notifications first" />
          <CardBody className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-body-muted">Nothing waiting on you.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-md border-l-4 px-3 py-2 ${
                    notification.read ? "border-line bg-surface-muted" : "border-amber-cta bg-amber-soft"
                  }`}
                >
                  <p className="font-semibold text-ink-900">{notification.title}</p>
                  <p className="text-sm text-body-muted">{notification.body}</p>
                  <p className="mt-1 text-xs text-body-muted">{relativeTime(notification.created_at)}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming appointments"
            action={
              <Link
                href="/dashboard/appointments"
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                View schedule
              </Link>
            }
          />
          <TableScroller>
            <Table className="min-w-[32rem]">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Customer</Th>
                  <Th>Service</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {upcomingAppointments.length === 0 ? (
                  <EmptyRow colSpan={4}>Nothing on the books yet.</EmptyRow>
                ) : (
                  upcomingAppointments.map(({ appointment, customer, service }) => (
                    <tr key={appointment.id} className="hover:bg-surface-muted">
                      <Td className="whitespace-nowrap font-semibold">
                        {formatInZone(new Date(appointment.start_time), business.timezone, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Td>
                      <Td>{customer ? customerName(customer) : "Unknown"}</Td>
                      <Td>{service?.name ?? "-"}</Td>
                      <Td>
                        <AppointmentStatusBadge status={appointment.status} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableScroller>
        </Card>

        <Card>
          <CardHeader
            title="Recent calls"
            action={
              <Link href="/dashboard/calls" className="text-sm font-semibold text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          <TableScroller>
            <Table className="min-w-[32rem]">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Direction</Th>
                  <Th>Length</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.length === 0 ? (
                  <EmptyRow colSpan={4}>No calls in the last 30 days.</EmptyRow>
                ) : (
                  recentCalls.map(({ call, customer }) => (
                    <tr key={call.id} className="hover:bg-surface-muted">
                      <Td>
                        <span className="font-semibold">{formatPhone(call.phone_number)}</span>
                        {customer ? (
                          <span className="block text-xs text-body-muted">{customerName(customer)}</span>
                        ) : null}
                      </Td>
                      <Td className="capitalize">{call.direction}</Td>
                      <Td>{formatDuration(call.duration)}</Td>
                      <Td>
                        <CallStatusBadge status={call.status} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableScroller>
        </Card>
      </div>
    </div>
  );
}
