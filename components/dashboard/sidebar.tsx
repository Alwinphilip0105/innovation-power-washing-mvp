"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Phone,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/estimates", label: "Estimates", icon: FileText },
  { href: "/dashboard/services", label: "Services", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-brand-500 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardSidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-950 lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/" aria-label="Back to the website">
            <Logo inverted />
          </Link>
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <p className="border-t border-white/10 px-5 py-4 text-xs text-white/50">{businessName}</p>
      </aside>

      {/* Mobile bar + drawer */}
      <div className="flex items-center justify-between gap-3 bg-ink-950 px-4 py-3 lg:hidden">
        <Link href="/" aria-label="Back to the website">
          <Logo inverted />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="dashboard-mobile-nav"
          className="rounded-md p-2 text-white hover:bg-white/10"
        >
          <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav
          id="dashboard-mobile-nav"
          aria-label="Dashboard"
          className="border-t border-white/10 bg-ink-950 p-3 lg:hidden"
        >
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </>
  );
}
