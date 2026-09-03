import type { Metadata } from "next";
import { Bell, LogOut } from "lucide-react";

import { signOutAction } from "@/app/login/actions";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { getStore } from "@/lib/db";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  bootstrap();

  const { user, business } = await requireAuth();
  const unread = await getStore().listNotifications(business.id, { unreadOnly: true, limit: 20 });

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted lg:flex-row">
      <DashboardSidebar businessName={business.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-ink-900">{business.name}</p>
            <p className="text-sm text-body-muted">
              Signed in as {user.name} &middot; {user.role}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-body-muted">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread.length > 0 ? (
                <Badge tone="bad">{unread.length} unread</Badge>
              ) : (
                <span>All caught up</span>
              )}
            </span>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-line-strong px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-surface-muted"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
