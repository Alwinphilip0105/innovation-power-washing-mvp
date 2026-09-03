import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { LeadForm } from "@/components/forms/lead-form";
import { Section } from "@/components/marketing/section";
import { WEEKDAYS } from "@/lib/utils/datetime";
import { formatPhone } from "@/lib/utils/phone";
import { getActiveServices, getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Call or text (973) 750-8757 for a free estimate. Innovation Power Washing serves Pompton Lakes, Wayne, and Pompton Wayne, NJ.",
};

const DAY_LABEL: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export default async function ContactPage() {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);
  const phoneDisplay = formatPhone(business.phone);

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="Contact"
        title="Talk to a person, or just send the details"
        intro="Send a text, chat on the phone, receive a quote. That is how Innovation books work — day or night."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-ink-900">Reach us</h2>
              <ul className="mt-4 space-y-4">
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <a href={`tel:${business.phone}`} className="font-display text-xl font-extrabold text-ink-900 hover:underline">
                      {phoneDisplay}
                    </a>
                    <span className="block text-sm text-body-muted">Call or text - we answer both</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <a href={`mailto:${business.email}`} className="font-semibold text-ink-900 hover:underline">
                      {business.email}
                    </a>
                    <span className="block text-sm text-body-muted">Replies within one business day</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink-900">{business.address}</span>
                    <span className="block text-sm text-body-muted">Shop and equipment yard - not a storefront</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink-900">
                      Chat with {business.settings.ai.assistantName}
                    </span>
                    <span className="block text-sm text-body-muted">
                      Bottom-right of any page, any hour. It can price and book for you.
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
                <Clock className="h-5 w-5 text-brand-500" aria-hidden="true" />
                Office hours
              </h2>
              <ul className="mt-4 space-y-1.5 text-sm">
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
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
            <h2 className="font-display text-2xl font-extrabold text-ink-900">Get a free estimate</h2>
            <p className="mt-2 text-body-muted">
              Fill this in and the office has it immediately. Most homes get a price the same day.
            </p>
            <div className="mt-6">
              <LeadForm
                services={services.map((service) => ({ slug: service.slug, name: service.name }))}
                phoneDisplay={phoneDisplay}
              />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
