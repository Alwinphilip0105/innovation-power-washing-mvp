import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { CtaBand } from "@/components/marketing/cta-band";
import { Section } from "@/components/marketing/section";
import { formatPhone } from "@/lib/utils/phone";
import { getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "Service Area",
  description:
    "Innovation Power Washing serves Pompton Lakes, Wayne, and Pompton Wayne, New Jersey.",
};

export default async function ServiceAreaPage() {
  const business = await getCurrentBusiness();
  const { counties, towns, description, radiusMiles } = business.settings.serviceArea;

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="Service area"
        title={`Northern New Jersey, within ${radiusMiles} miles of Pompton Lakes`}
        intro={description}
      />

      <Section eyebrow="Counties" title="Where our trucks run every week">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {counties.map((county) => (
            <div
              key={county}
              className="rounded-lg border border-line bg-surface p-5 text-center shadow-card"
            >
              <MapPin className="mx-auto h-6 w-6 text-brand-500" aria-hidden="true" />
              <p className="mt-2 font-display text-lg font-bold text-ink-900">{county}</p>
              <p className="text-sm text-body-muted">County, NJ</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        tone="muted"
        eyebrow="Towns"
        title="Towns we serve regularly"
        intro="Not on the list? Call us anyway - we batch out-of-area work and can usually fit you into a nearby route."
      >
        <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {towns.map((town) => (
            <li
              key={town}
              className="flex items-center gap-2 rounded-md bg-surface px-4 py-3 shadow-card"
            >
              <MapPin className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
              <span className="font-semibold text-ink-900">{town}</span>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        phoneDisplay={formatPhone(business.phone)}
        phoneHref={`tel:${business.phone}`}
        heading="Not sure if you are in range?"
        body="Send us your address. If we cannot get to you we will tell you straight away and point you somewhere that can."
      />
    </>
  );
}
