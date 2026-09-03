import type { Metadata } from "next";
import { Award, Truck, Users } from "lucide-react";

import { Scene } from "@/components/graphics/scenes";
import { CtaBand } from "@/components/marketing/cta-band";
import { Section } from "@/components/marketing/section";
import { formatPhone } from "@/lib/utils/phone";
import { getCurrentBusiness } from "@/services/business";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Innovation Power Washing is an owner-run pressure washing company in Pompton Lakes, New Jersey, serving Wayne and Pompton Wayne homes and businesses.",
};

const STATS = [
  { icon: Users, value: "Eric", label: "hands-on owner, not a franchise" },
  { icon: Truck, value: "24/7", label: "text or call for a quote" },
  { icon: Award, value: "Insured", label: "proof of insurance on request" },
];

export default async function AboutPage() {
  const business = await getCurrentBusiness();

  return (
    <>
      <Section
        headingLevel={1}
        tone="dark"
        eyebrow="About us"
        title="A Pompton Lakes company, not a franchise"
        intro="Innovation Power Washing is owner-run. Neighbors and property managers talk about Eric by name — he keeps in touch, shows up when he says he will, and stays involved until the job looks right."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4 text-lg leading-relaxed text-body">
            <p>
              We are a local Pompton Lakes crew. Reviews mention the same things over and over:
              they arrive on time (often early), they are careful with plants and flowers, they
              leave no mess, and the owner answers the phone.
            </p>
            <p>
              Work is matched to the surface — a low-pressure house wash, a soft chemical wash for
              moss on a roof, and real pressure where concrete, pavers and fences need it. Painting
              and staining, windows, gutters and holiday lights sit alongside the wash work.
            </p>
            <p>
              We are fully insured. Property managers and homeowners can ask for proof of insurance
              and we send it. Text or call (973) 750-8757 any time — the live site lists us as open
              24 hours for quotes.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-line shadow-card">
            <div className="aspect-[4/3]">
              <Scene kind="storefront" state="after" label="A cleaned storefront in Wayne, NJ" />
            </div>
          </div>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, value, label }) => (
            <li key={label} className="rounded-lg border border-line bg-surface p-6 text-center shadow-card">
              <Icon className="mx-auto h-8 w-8 text-brand-500" aria-hidden="true" />
              <p className="mt-3 font-display text-3xl font-extrabold text-ink-900">{value}</p>
              <p className="mt-1 text-sm text-body-muted">{label}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" eyebrow="How we work" title="Our promises, in writing" center>
        <ul className="mx-auto max-w-3xl space-y-3">
          {business.settings.policies.map((policy) => (
            <li key={policy} className="rounded-md border-l-4 border-brand-500 bg-surface px-5 py-4 shadow-card">
              {policy}
            </li>
          ))}
        </ul>
        {business.settings.licensing ? (
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-body-muted">
            {business.settings.licensing}
          </p>
        ) : null}
      </Section>

      <CtaBand phoneDisplay={formatPhone(business.phone)} phoneHref={`tel:${business.phone}`} />
    </>
  );
}
