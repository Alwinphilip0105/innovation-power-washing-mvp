import type { Metadata } from "next";
import Link from "next/link";

import { CallStatusBadge } from "@/components/dashboard/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { formatDuration, formatInZone } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { customerName } from "@/services/customers";

export const metadata: Metadata = { title: "Calls" };

export default async function CallsPage() {
  const { business } = await requireAuth("/dashboard/calls");
  const store = getStore();

  const calls = await store.listCalls(business.id, { limit: 100 });
  const customers = await Promise.all(
    [...new Set(calls.map((call) => call.customer_id).filter(Boolean))].map((id) =>
      store.getCustomerById(business.id, id as string),
    ),
  );
  const customerMap = new Map(customers.filter(Boolean).map((customer) => [customer!.id, customer!]));

  const missed = calls.filter((call) => call.status === "missed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Calls</h1>
        <p className="text-body-muted">
          {calls.length} recorded, {missed} missed. Every missed inbound call gets an automatic
          follow-up text, and the assistant handles the reply.
        </p>
      </div>

      <Card>
        <CardHeader title="Call log" description="Most recent first" />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Number</Th>
                <Th>Direction</Th>
                <Th>Length</Th>
                <Th>Status</Th>
                <Th>Outcome</Th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <EmptyRow colSpan={6}>No calls recorded.</EmptyRow>
              ) : (
                calls.map((call) => {
                  const customer = call.customer_id ? customerMap.get(call.customer_id) : null;
                  return (
                    <tr key={call.id} className="hover:bg-surface-muted">
                      <Td className="whitespace-nowrap">
                        {formatInZone(new Date(call.started_at), business.timezone, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Td>
                      <Td>
                        <span className="font-semibold">{formatPhone(call.phone_number)}</span>
                        {customer ? (
                          <span className="block text-xs text-body-muted">
                            {call.lead_id ? (
                              <Link
                                href={`/dashboard/leads/${call.lead_id}`}
                                className="text-brand-600 hover:underline"
                              >
                                {customerName(customer)}
                              </Link>
                            ) : (
                              customerName(customer)
                            )}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="capitalize">{call.direction}</Td>
                      <Td>{formatDuration(call.duration)}</Td>
                      <Td>
                        <CallStatusBadge status={call.status} />
                      </Td>
                      <Td className="max-w-sm">
                        {call.summary ? (
                          <span className="text-body-muted">{call.summary}</span>
                        ) : (
                          <span className="text-body-muted">
                            {call.outcome ? call.outcome.replace(/_/g, " ") : "-"}
                          </span>
                        )}
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
