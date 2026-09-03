import { getStore } from "@/lib/db";
import { withContext, type AppointmentWithContext } from "@/services/appointments";
import { toZonedDateIso, parseZonedDateTime } from "@/lib/utils/datetime";
import type { Business, Call, Customer, Lead, Notification } from "@/lib/db/types";

export interface DashboardMetrics {
  newLeads: number;
  leadsThisMonth: number;
  upcomingAppointments: number;
  missedCalls: number;
  /** Percent of this month's leads that reached booked or completed. */
  conversionRate: number;
  pipelineValue: number;
}

export interface LeadWithCustomer {
  lead: Lead;
  customer: Customer | null;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentLeads: LeadWithCustomer[];
  upcomingAppointments: AppointmentWithContext[];
  recentCalls: Array<{ call: Call; customer: Customer | null }>;
  notifications: Notification[];
}

/** First instant of the current month, in the business's timezone. */
function monthStart(business: Business, now: Date): string {
  const today = toZonedDateIso(now, business.timezone);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  return parseZonedDateTime(firstOfMonth, "00:00", business.timezone).toISOString();
}

async function attachCustomers<T extends { customer_id: string | null }>(
  business: Business,
  rows: T[],
): Promise<Array<{ row: T; customer: Customer | null }>> {
  const store = getStore();
  const ids = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))] as string[];
  const customers = await Promise.all(ids.map((id) => store.getCustomerById(business.id, id)));
  const map = new Map(customers.filter(Boolean).map((customer) => [customer!.id, customer!]));

  return rows.map((row) => ({
    row,
    customer: row.customer_id ? (map.get(row.customer_id) ?? null) : null,
  }));
}

export async function getDashboardData(business: Business, now: Date = new Date()): Promise<DashboardData> {
  const store = getStore();
  const since = monthStart(business, now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [allLeads, monthLeads, appointments, calls, notifications] = await Promise.all([
    store.listLeads(business.id, { limit: 200 }),
    store.listLeads(business.id, { createdAfter: since }),
    store.listAppointments(business.id, {
      from: now.toISOString(),
      status: ["requested", "confirmed"],
      limit: 25,
    }),
    store.listCalls(business.id, { createdAfter: thirtyDaysAgo, limit: 25 }),
    store.listNotifications(business.id, { limit: 8 }),
  ]);

  const converted = monthLeads.filter((lead) => lead.status === "booked" || lead.status === "completed");
  const openStatuses = new Set(["new", "contacted", "qualified", "estimate_requested", "estimate_sent", "booked"]);

  const metrics: DashboardMetrics = {
    newLeads: allLeads.filter((lead) => lead.status === "new").length,
    leadsThisMonth: monthLeads.length,
    upcomingAppointments: appointments.length,
    missedCalls: calls.filter((call) => call.status === "missed").length,
    conversionRate: monthLeads.length === 0 ? 0 : Math.round((converted.length / monthLeads.length) * 100),
    pipelineValue: allLeads
      .filter((lead) => openStatuses.has(lead.status))
      .reduce((total, lead) => total + (lead.estimated_value ?? 0), 0),
  };

  const [recentLeadRows, recentCallRows, upcomingAppointments] = await Promise.all([
    attachCustomers(business, allLeads.slice(0, 6)),
    attachCustomers(business, calls.slice(0, 5)),
    withContext(business, appointments.slice(0, 5)),
  ]);

  return {
    metrics,
    recentLeads: recentLeadRows.map(({ row, customer }) => ({ lead: row, customer })),
    upcomingAppointments,
    recentCalls: recentCallRows.map(({ row, customer }) => ({ call: row, customer })),
    notifications,
  };
}
