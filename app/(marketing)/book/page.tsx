import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";

import { BookingFlow } from "@/components/booking/booking-flow";
import { LeadForm } from "@/components/forms/lead-form";
import { Section } from "@/components/marketing/section";
import { formatPhone } from "@/lib/utils/phone";
import { getActiveServices, getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "Book a Free Estimate",
  description:
    "Pick a real opening on our schedule, or send us your details and we will call you back with a written estimate.",
};

// `?service=` is applied by the forms themselves, in the browser — see
// lib/hooks/use-requested-service.ts. Reading it here instead would make this
// page impossible to prerender, and the static build has no request to read.
export default async function BookPage() {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);
  const phoneDisplay = formatPhone(business.phone);

  const timezoneLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone,
    timeZoneName: "long",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "Eastern Time";

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="Book online"
        title="Grab a slot, or have us call you"
        intro="Everything below is our actual availability. Pick a time and it is yours - the office confirms by phone before the day."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
          <div className="rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
            <BookingFlow
              services={services.map((service) => ({
                slug: service.slug,
                name: service.name,
                durationMinutes: service.duration_minutes,
                startingPrice: service.starting_price,
                quoteOnly: service.pricing_model === "quote_only",
              }))}
              phoneDisplay={phoneDisplay}
              timezoneLabel={timezoneLabel}
            />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-32">
            <div className="rounded-lg border-2 border-brand-500 bg-brand-50 p-6">
              <h2 className="font-display text-lg font-bold text-ink-900">Rather just talk it through?</h2>
              <p className="mt-2 text-sm text-body">
                Call the office during business hours and someone picks up. Outside hours, leave your
                details and we will call first thing.
              </p>
              <a
                href={`tel:${business.phone}`}
                className="mt-4 inline-flex items-center gap-2 font-display text-2xl font-extrabold text-brand-700 hover:underline"
              >
                <Phone className="h-6 w-6" aria-hidden="true" />
                {phoneDisplay}
              </a>
            </div>

            <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-ink-900">
                Need a quote before you commit?
              </h2>
              <p className="mt-2 text-sm text-body-muted">
                Roofs and commercial work are always quoted after a look. Send the details and we will
                come back with a written price.
              </p>
              <div className="mt-5">
                <LeadForm
                  compact
                  services={services.map((service) => ({ slug: service.slug, name: service.name }))}
                  phoneDisplay={phoneDisplay}
                />
              </div>
            </div>

            <p className="text-center text-sm text-body-muted">
              Not sure which service you need?{" "}
              <Link href="/services" className="font-semibold text-brand-600 hover:underline">
                Compare everything we clean
              </Link>
              .
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
