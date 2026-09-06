"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { buttonClasses } from "@/components/ui/button";
import { DemoCallButton } from "@/components/demo/demo-call";
import { serverHref } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Before & After" },
  { href: "/service-area", label: "Service Area" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({
  phoneDisplay,
  phoneHref,
  hoursNote,
}: {
  phoneDisplay: string;
  phoneHref: string;
  hoursNote: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="bg-ink-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 text-xs sm:text-sm">
          <p className="font-semibold">{hoursNote}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-white/80">
              Fully insured &middot; Pompton Lakes, Wayne &amp; Pompton Wayne, NJ
            </p>
            {/* Sign-in is server-rendered, so on the static build it lives on
                the full deployment rather than on this host. */}
            <a
              href={serverHref("/login")}
              className="whitespace-nowrap font-semibold text-white underline-offset-2 hover:underline"
            >
              Staff Login
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="Innovation Power Washing home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-[0.95rem] font-semibold transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-900 hover:bg-surface-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={phoneHref}
            className="hidden items-center gap-2 rounded-md px-3 py-2 font-display text-lg font-extrabold text-ink-900 hover:bg-surface-muted sm:inline-flex"
          >
            <Phone className="h-5 w-5 text-brand-500" aria-hidden="true" />
            {phoneDisplay}
          </a>
          <Link href="/book" className={buttonClasses({ size: "sm", className: "hidden sm:inline-flex" })}>
            Get a Free Estimate
          </Link>

          <DemoCallButton
            className={buttonClasses({ variant: "secondary", size: "sm", className: "sm:hidden" })}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
          </DemoCallButton>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-md p-2 text-ink-900 hover:bg-surface-muted lg:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-surface lg:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-2 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="block rounded-md px-3 py-3 font-semibold text-ink-900 hover:bg-surface-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="px-3 py-2">
              <Link href="/book" onClick={close} className={buttonClasses({ className: "w-full" })}>
                Get a Free Estimate
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
