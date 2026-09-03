import type { Metadata } from "next";

import { BeforeAfterGallery } from "@/components/marketing/before-after";
import { CtaBand } from "@/components/marketing/cta-band";
import { Section } from "@/components/marketing/section";
import { Testimonials } from "@/components/marketing/testimonials";
import { GALLERY, TESTIMONIALS } from "@/lib/config/content";
import { formatPhone } from "@/lib/utils/phone";
import { getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "Before & After Gallery",
  description:
    "Before and after results from house, roof, concrete and fence jobs in Pompton Lakes and Wayne, New Jersey.",
};

export default async function GalleryPage() {
  const business = await getCurrentBusiness();

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="Before and after"
        title="The results speak for themselves"
        intro="Every one of these is a real job in a town we serve. Drag the slider on any of them to see exactly what came off."
      />

      <Section>
        <BeforeAfterGallery items={GALLERY} />
      </Section>

      <Section tone="muted" eyebrow="Reviews" title="What those customers said" center>
        <Testimonials items={TESTIMONIALS} />
      </Section>

      <CtaBand
        phoneDisplay={formatPhone(business.phone)}
        phoneHref={`tel:${business.phone}`}
        heading="Want your house on this page?"
        body="Send us your address and what needs cleaning. We will get you a written price with no obligation."
      />
    </>
  );
}
