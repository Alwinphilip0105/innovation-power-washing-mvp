import type { Metadata } from "next";
import Link from "next/link";

import { EstimateStatusBadge } from "@/components/dashboard/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { relativeTime } from "@/lib/utils/datetime";
import { customerName } from "@/services/customers";

export const metadata: Metadata = { title: "Estimates" };

export default async function EstimatesPage() {
  const { business } = await requireAuth("/dashboard/estimates");
  const store = getStore();

  const estimates = await store.listEstimates(business.id, { limit: 100 });
  const customers = await Promise.all(
    [...new Set(estimates.map((estimate) => estimate.customer_id))].map((id) =>
      store.getCustomerById(business.id, id),
    ),
  );
  const customerMap = new Map(customers.filter(Boolean).map((customer) => [customer!.id, customer!]));

  const outstanding = estimates.filter((estimate) =>
    ["requested", "draft", "sent"].includes(estimate.status),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Estimates</h1>
        <p className="text-body-muted">
          {outstanding} outstanding. The assistant creates an estimate request whenever a job has no
          configured price - it never quotes a number itself.
        </p>
      </div>

      <Card>
        <CardHeader title="All estimates" description="Newest first" />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Notes</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 ? (
                <EmptyRow colSpan={5}>No estimates yet.</EmptyRow>
              ) : (
                estimates.map((estimate) => {
                  const customer = customerMap.get(estimate.customer_id);
                  return (
                    <tr key={estimate.id} className="hover:bg-surface-muted">
                      <Td>
                        {estimate.lead_id ? (
                          <Link
                            href={`/dashboard/leads/${estimate.lead_id}`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            {customer ? customerName(customer) : "Unknown"}
                          </Link>
                        ) : (
                          <span className="font-semibold">
                            {customer ? customerName(customer) : "Unknown"}
                          </span>
                        )}
                      </Td>
                      <Td className="font-display text-lg font-bold text-ink-900">
                        {estimate.amount != null ? `$${estimate.amount}` : "Not priced"}
                      </Td>
                      <Td>
                        <EstimateStatusBadge status={estimate.status} />
                      </Td>
                      <Td className="max-w-md text-body-muted">{estimate.notes ?? "-"}</Td>
                      <Td className="whitespace-nowrap text-body-muted">
                        {relativeTime(estimate.created_at)}
                      </Td>
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
