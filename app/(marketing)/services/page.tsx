import type { Metadata } from "next";

import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { Section } from "@/components/marketing/section";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { formatPhone } from "@/lib/utils/phone";
import { getActiveServices, getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "House washing, pressure and power washing, roof and window cleaning, concrete, gutters, fences, graffiti removal, commercial work, painting, staining and Christmas lights in Pompton Lakes and Wayne, NJ.",
};

export default async function ServicesPage() {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="Services"
        title="What we clean"
        intro="Every job is quoted. Send a text or the form with your address — we do not publish a price list because size, height and condition change the number."
      />

      <Section>
        <ServicesGrid services={services} detailed />
      </Section>

      <Section tone="muted" eyebrow="Our policies" title="The fine print, in plain English" center>
        <ul className="mx-auto max-w-3xl space-y-3">
          {business.settings.policies.map((policy) => (
            <li
              key={policy}
              className="rounded-md border-l-4 border-brand-500 bg-surface px-5 py-4 shadow-card"
            >
              {policy}
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Questions" title="Common questions about our work" center>
        <Faq faqs={business.settings.faqs} />
      </Section>

      <CtaBand phoneDisplay={formatPhone(business.phone)} phoneHref={`tel:${business.phone}`} />
    </>
  );
}
