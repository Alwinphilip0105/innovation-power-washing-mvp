import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Phone, Smartphone } from "lucide-react";

import { ConversationStatusBadge } from "@/components/dashboard/status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/utils/datetime";
import { customerName } from "@/services/customers";
import { listConversationSummaries } from "@/services/conversations";

export const metadata: Metadata = { title: "Conversations" };

const CHANNEL_ICON = { web: MessageSquare, sms: Smartphone, phone: Phone } as const;

export default async function ConversationsPage() {
  const { business } = await requireAuth("/dashboard/conversations");
  const rows = await listConversationSummaries(business);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Conversations</h1>
        <p className="text-body-muted">
          Website chat, SMS and phone threads all land here. Anything marked &ldquo;needs a person&rdquo;
          was escalated by the assistant.
        </p>
      </div>

      <Card>
        <CardHeader title="All threads" description="Most recently active first" />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th>Customer</Th>
                <Th>Last message</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>No conversations yet.</EmptyRow>
              ) : (
                rows.map(({ conversation, customer, messageCount, lastMessage }) => {
                  const Icon = CHANNEL_ICON[conversation.channel];
                  return (
                    <tr key={conversation.id} className="hover:bg-surface-muted">
                      <Td>
                        <span className="inline-flex items-center gap-2 font-semibold capitalize">
                          <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
                          {conversation.channel}
                        </span>
                        <span className="block text-xs text-body-muted">{messageCount} messages</span>
                      </Td>
                      <Td>
                        <Link
                          href={`/dashboard/conversations/${conversation.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {customer ? customerName(customer) : "Unidentified visitor"}
                        </Link>
                      </Td>
                      <Td className="max-w-md">
                        <span className="line-clamp-2 text-body-muted">
                          {lastMessage?.body ?? "No messages yet."}
                        </span>
                      </Td>
                      <Td>
                        <ConversationStatusBadge status={conversation.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-body-muted">
                        {relativeTime(conversation.updated_at)}
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
