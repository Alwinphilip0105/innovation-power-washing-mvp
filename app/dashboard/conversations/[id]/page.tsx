import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ConversationStatusBadge } from "@/components/dashboard/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { formatInZone } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { cn } from "@/lib/utils/cn";
import { customerName } from "@/services/customers";
import { getConversationThread } from "@/services/conversations";

export const metadata: Metadata = { title: "Conversation" };

const SENDER_LABEL = {
  customer: "Customer",
  ai: "Assistant",
  staff: "Staff",
  system: "System",
} as const;

export default async function ConversationPage({ params }: PageProps<"/dashboard/conversations/[id]">) {
  const { id } = await params;
  const { business } = await requireAuth(`/dashboard/conversations/${id}`);

  const thread = await getConversationThread(business, id);
  if (!thread) notFound();

  const { conversation, customer, messages } = thread;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/conversations"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to conversations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">
            {customer ? customerName(customer) : "Unidentified visitor"}
          </h1>
          <p className="capitalize text-body-muted">
            {conversation.channel} conversation
            {customer?.phone ? ` · ${formatPhone(customer.phone)}` : ""}
            {conversation.subject ? ` · ${conversation.subject}` : ""}
          </p>
        </div>
        <ConversationStatusBadge status={conversation.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
        <Card>
          <CardHeader title="Transcript" description={`${messages.length} messages`} />
          <CardBody className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-body-muted">No messages in this thread.</p>
            ) : (
              messages.map((message) => {
                const inbound = message.direction === "inbound";
                return (
                  <div key={message.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
                    <div className={cn("max-w-[80%]", inbound ? "text-left" : "text-right")}>
                      <p
                        className={cn(
                          "inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left",
                          inbound
                            ? "rounded-bl-sm bg-surface-muted text-body"
                            : message.sender === "ai"
                              ? "rounded-br-sm bg-brand-500 text-white"
                              : "rounded-br-sm bg-ink-900 text-white",
                        )}
                      >
                        {message.body}
                      </p>
                      <p className="mt-1 text-xs text-body-muted">
                        {SENDER_LABEL[message.sender]} &middot;{" "}
                        {formatInZone(new Date(message.created_at), business.timezone, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {message.status ? ` · ${message.status}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Started:</span>{" "}
                {formatInZone(new Date(conversation.created_at), business.timezone)}
              </p>
              <p>
                <span className="font-semibold">Last activity:</span>{" "}
                {formatInZone(new Date(conversation.updated_at), business.timezone)}
              </p>
              {conversation.lead_id ? (
                <p>
                  <Link
                    href={`/dashboard/leads/${conversation.lead_id}`}
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Open the linked lead
                  </Link>
                </p>
              ) : (
                <p className="text-body-muted">No lead linked yet.</p>
              )}
            </CardBody>
          </Card>

          {conversation.status === "escalated" ? (
            <Card className="border-warn/40">
              <CardHeader title="Escalated" description="The assistant handed this to a person" />
              <CardBody className="text-sm text-body-muted">
                Call the customer back and then set the linked lead to the right status. The assistant
                will not keep replying on this thread.
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
