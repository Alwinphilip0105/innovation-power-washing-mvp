import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { LeadStatusBadge, LEAD_STATUS_LABELS } from "@/components/dashboard/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/types";
import { relativeTime } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { customerName } from "@/services/customers";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const { business } = await requireAuth("/dashboard/leads");
  const params = await searchParams;

  const rawStatus = typeof params.status === "string" ? params.status : undefined;
  const status = LEAD_STATUSES.includes(rawStatus as LeadStatus) ? (rawStatus as LeadStatus) : undefined;
  const search = typeof params.q === "string" ? params.q.slice(0, 80) : undefined;

  const store = getStore();
  const leads = await store.listLeads(business.id, { status, search, limit: 200 });

  const customers = await Promise.all(
    [...new Set(leads.map((lead) => lead.customer_id))].map((id) =>
      store.getCustomerById(business.id, id),
    ),
  );
  const customerMap = new Map(customers.filter(Boolean).map((customer) => [customer!.id, customer!]));

  const filters: Array<{ label: string; value?: LeadStatus }> = [
    { label: "All" },
    ...LEAD_STATUSES.map((value) => ({ label: LEAD_STATUS_LABELS[value], value })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leads</h1>
          <p className="text-body-muted">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
            {status ? ` with status "${LEAD_STATUS_LABELS[status]}"` : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
        </div>

        <form className="flex items-center gap-2" role="search">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="lead-search" className="sr-only">
            Search leads
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body-muted"
              aria-hidden="true"
            />
            <input
              id="lead-search"
              name="q"
              defaultValue={search}
              placeholder="Name, phone, service..."
              className="w-64 rounded-md border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Search
          </button>
        </form>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = filter.value === status;
          const href = filter.value
            ? `/dashboard/leads?status=${filter.value}${search ? `&q=${encodeURIComponent(search)}` : ""}`
            : `/dashboard/leads${search ? `?q=${encodeURIComponent(search)}` : ""}`;
          return (
            <Link
              key={filter.label}
              href={href}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold",
                active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-line-strong bg-surface text-ink-900 hover:bg-surface-muted",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader title="All leads" description="Click a lead to open the full record" />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Service</Th>
                <Th>Source</Th>
                <Th>Value</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <EmptyRow colSpan={6}>
                  No leads match that filter.{" "}
                  <Link href="/dashboard/leads" className="font-semibold text-brand-600 hover:underline">
                    Clear filters
                  </Link>
                </EmptyRow>
              ) : (
                leads.map((lead) => {
                  const customer = customerMap.get(lead.customer_id);
                  return (
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
                      <Td>{lead.estimated_value != null ? `$${lead.estimated_value}` : "-"}</Td>
                      <Td>
                        <LeadStatusBadge status={lead.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-body-muted">{relativeTime(lead.created_at)}</Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableScroller>
      </Card>
    </div>
  );
}
