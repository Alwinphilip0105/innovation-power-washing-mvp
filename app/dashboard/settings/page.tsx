import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableScroller, Td, Th } from "@/components/ui/table";
import { getAIProvider } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { getBookingProvider } from "@/lib/booking";
import { getStore } from "@/lib/db";
import { dataStoreKind } from "@/lib/env";
import { getEmailOutbox, getEmailProvider } from "@/lib/notifications/providers";
import { getSmsProvider } from "@/lib/sms/providers";
import { formatInZone, WEEKDAYS } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { getVoiceProvider } from "@/lib/voice/provider";

export const metadata: Metadata = { title: "Settings" };

const DAY_LABEL: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export default async function SettingsPage() {
  const { business } = await requireAuth("/dashboard/settings");
  const store = getStore();

  const [users, aiActions] = await Promise.all([
    store.listUsers(business.id),
    store.listAiActions(business.id, { limit: 15 }),
  ]);

  const outbox = getEmailOutbox();
  const rules = business.settings.bookingRules;

  const providers = [
    { label: "Data store", value: dataStoreKind },
    { label: "AI assistant", value: getAIProvider().name },
    { label: "Booking", value: getBookingProvider().name },
    { label: "SMS", value: getSmsProvider().name },
    { label: "Voice", value: getVoiceProvider().name },
    { label: "Email", value: getEmailProvider().name },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Settings</h1>
        <p className="text-body-muted">
          Business configuration, wired providers, and the assistant&apos;s audit trail.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Business" />
          <CardBody className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {business.name}
            </p>
            <p>
              <span className="font-semibold">Phone:</span> {formatPhone(business.phone)}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {business.email}
            </p>
            <p>
              <span className="font-semibold">Address:</span> {business.address}
            </p>
            <p>
              <span className="font-semibold">Timezone:</span> {business.timezone}
            </p>
            <p>
              <span className="font-semibold">Owner alerts to:</span>{" "}
              {business.settings.notifications.ownerEmail}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Booking rules" description="Enforced on every booking path" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-semibold text-ink-900">Minimum notice</dt>
                <dd className="text-body-muted">{rules.minNoticeMinutes / 60} hours</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-900">Books out to</dt>
                <dd className="text-body-muted">{rules.maxAdvanceDays} days</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-900">Slot interval</dt>
                <dd className="text-body-muted">{rules.slotIntervalMinutes} minutes</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-900">Buffer between jobs</dt>
                <dd className="text-body-muted">{rules.bufferMinutes} minutes</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-900">Crews at once</dt>
                <dd className="text-body-muted">{rules.maxConcurrentAppointments}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Business hours" />
          <CardBody>
            <ul className="space-y-1.5 text-sm">
              {WEEKDAYS.map((day) => {
                const windows = business.business_hours[day] ?? [];
                return (
                  <li key={day} className="flex justify-between gap-4">
                    <span className="font-semibold text-ink-900">{DAY_LABEL[day]}</span>
                    <span className="text-body-muted">
                      {windows.length === 0
                        ? "Closed"
                        : windows.map((w) => `${w.open} - ${w.close}`).join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Providers" description="What is actually wired right now" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {providers.map((provider) => (
                <li key={provider.label} className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink-900">{provider.label}</span>
                  <Badge tone={provider.value.includes("mock") || provider.value === "memory" ? "warn" : "good"}>
                    {provider.value}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-body-muted">
              Anything marked in amber is a development provider. Set the matching environment
              variables to switch to a live vendor - see docs/DEPLOYMENT.md.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Team" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-semibold text-ink-900">{user.name}</span>
                    <span className="block text-body-muted">{user.email}</span>
                  </span>
                  <Badge tone={user.role === "owner" ? "dark" : "neutral"}>{user.role}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Mock email outbox"
            description="What the notification service would have sent"
          />
          <CardBody className="space-y-2">
            {outbox.length === 0 ? (
              <p className="text-sm text-body-muted">
                Nothing sent this session. Submit a lead on the website to see one land here.
              </p>
            ) : (
              outbox.slice(0, 6).map((entry) => (
                <div key={entry.id} className="rounded-md border border-line px-3 py-2 text-sm">
                  <p className="font-semibold text-ink-900">{entry.subject}</p>
                  <p className="text-xs text-body-muted">
                    to {entry.to} &middot; {formatInZone(new Date(entry.sentAt), business.timezone)}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-body-muted">{entry.text}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Assistant audit trail"
          description="Every tool the assistant called, and whether it succeeded"
        />
        <TableScroller>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Tool</Th>
                <Th>Result</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {aiActions.length === 0 ? (
                <EmptyRow colSpan={4}>No assistant activity yet.</EmptyRow>
              ) : (
                aiActions.map((action) => (
                  <tr key={action.id} className="hover:bg-surface-muted">
                    <Td className="whitespace-nowrap text-body-muted">
                      {formatInZone(new Date(action.created_at), business.timezone, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td className="font-mono text-xs">{action.action_type}</Td>
                    <Td>
                      <Badge tone={action.success ? "good" : "bad"}>
                        {action.success ? "ok" : "failed"}
                      </Badge>
                    </Td>
                    <Td className="max-w-md">
                      <code className="block truncate text-xs text-body-muted">
                        {JSON.stringify(action.output)}
                      </code>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableScroller>
      </Card>
    </div>
  );
}
