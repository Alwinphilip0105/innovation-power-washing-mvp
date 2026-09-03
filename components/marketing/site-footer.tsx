import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { WEEKDAYS } from "@/lib/utils/datetime";
import type { Business, Service } from "@/lib/db/types";
import { formatPhone } from "@/lib/utils/phone";

const DAY_LABEL: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function to12Hour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${display} ${suffix}` : `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function SiteFooter({ business, services }: { business: Business; services: Service[] }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t-4 border-brand-500 bg-ink-950 text-white/85">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo inverted />
          <p className="mt-4 text-sm leading-relaxed">{business.settings.tagline}</p>
          {business.settings.licensing ? (
            <p className="mt-4 text-xs leading-relaxed text-white/60">{business.settings.licensing}</p>
          ) : null}
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Services</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {services.map((service) => (
              <li key={service.id}>
                <Link href={`/services#${service.slug}`} className="hover:text-white hover:underline">
                  {service.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Hours</h2>
          <ul className="mt-4 space-y-1.5 text-sm">
            {WEEKDAYS.map((day) => {
              const windows = business.business_hours[day] ?? [];
              return (
                <li key={day} className="flex justify-between gap-3">
                  <span>{DAY_LABEL[day]}</span>
                  <span className="text-white/70">
                    {windows.length === 0
                      ? "Closed"
                      : windows.map((w) => `${to12Hour(w.open)} - ${to12Hour(w.close)}`).join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
              <a href={`tel:${business.phone}`} className="font-semibold text-white hover:underline">
                {formatPhone(business.phone)}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
              <a href={`mailto:${business.email}`} className="hover:underline">
                {business.email}
              </a>
            </li>
            {business.address ? (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
                <span>{business.address}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {business.name}. All rights reserved.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link href="/service-area" className="hover:text-white">
              Service Area
            </Link>
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
            <Link href="/book" className="hover:text-white">
              Free Estimate
            </Link>
            <Link href="/login" className="hover:text-white">
              Staff Login
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
