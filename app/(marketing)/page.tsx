import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { BeforeAfterGallery } from "@/components/marketing/before-after";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Section } from "@/components/marketing/section";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { Testimonials } from "@/components/marketing/testimonials";
import { TrustBar } from "@/components/marketing/trust-bar";
import { LeadForm } from "@/components/forms/lead-form";
import { ButtonLink } from "@/components/ui/button";
import { DIFFERENTIATORS, GALLERY, PROCESS, TESTIMONIALS } from "@/lib/config/content";
import { formatPhone } from "@/lib/utils/phone";
import { getActiveServices, getCurrentBusiness } from "@/services/business";

export default async function HomePage() {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);
  const phoneDisplay = formatPhone(business.phone);
  const phoneHref = `tel:${business.phone}`;

  return (
    <>
      <Hero
        phoneDisplay={phoneDisplay}
        phoneHref={phoneHref}
        towns={business.settings.serviceArea.towns}
      />
      <TrustBar />

      <Section
        eyebrow="What we clean"
        title="What we are best at"
        intro="House washing, roofs, concrete, gutters, fences, windows, commercial work, painting and staining, and holiday lights — the same list as our live site."
      >
        <ServicesGrid services={services} />
      </Section>

      <Section
        tone="muted"
        eyebrow="Why homeowners call us back"
        title="The part most companies get wrong"
        intro="Exterior cleaning is easy to do badly and hard to undo. Here is what we do differently."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {DIFFERENTIATORS.map((item, index) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface p-6 shadow-card">
              <span className="font-display text-3xl font-extrabold text-brand-200">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-xl font-bold text-ink-900">{item.title}</h3>
              <p className="mt-2 text-body-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="Four steps, no surprises"
        center
        intro="From the first message to the final walk-through, you always know what happens next."
      >
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((step, index) => (
            <li key={step.title} className="relative rounded-lg border border-line bg-surface p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-display text-lg font-extrabold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-sm text-body-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        tone="muted"
        eyebrow="Before and after"
        title="Real jobs from Pompton Lakes and Wayne"
        intro="Drag the slider on any job to see what came off."
      >
        <BeforeAfterGallery items={GALLERY.slice(0, 4)} />
        <p className="mt-8 text-center">
          <Link href="/gallery" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
            See more before and after jobs
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </Section>

      <Section eyebrow="Reviews" title="What neighbors say" center>
        <Testimonials items={TESTIMONIALS.slice(0, 3)} />
      </Section>

      <Section tone="dark" eyebrow="Service area" title="Pompton Lakes, Wayne, and Pompton Wayne">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <p className="text-lg text-white/80">{business.settings.serviceArea.description}</p>
            <p className="mt-6 font-display text-sm font-bold uppercase tracking-wider text-brand-400">
              Counties covered
            </p>
            <p className="mt-1 text-white/85">
              {business.settings.serviceArea.counties.join(", ")}
            </p>
            <ButtonLink href="/service-area" variant="primary" className="mt-6">
              Check your town
            </ButtonLink>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {business.settings.serviceArea.towns.map((town) => (
              <li key={town} className="flex items-center gap-2 text-white/85">
                <MapPin className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
                {town}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section eyebrow="Questions" title="Answers before you ask" center>
        <Faq faqs={business.settings.faqs} />
      </Section>

      <Section id="estimate" tone="muted" eyebrow="Free estimate" title="Tell us what needs cleaning" center>
        <div className="mx-auto max-w-2xl rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
          <LeadForm
            services={services.map((service) => ({ slug: service.slug, name: service.name }))}
            phoneDisplay={phoneDisplay}
          />
        </div>
      </Section>

      <CtaBand phoneDisplay={phoneDisplay} phoneHref={phoneHref} />
    </>
  );
}
