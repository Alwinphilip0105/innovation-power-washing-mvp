import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Scene, SCENE_FOR_SERVICE } from "@/components/graphics/scenes";
import { formatServicePrice } from "@/lib/ai/prompt";
import type { Service } from "@/lib/db/types";

export function ServiceCard({ service, detailed = false }: { service: Service; detailed?: boolean }) {
  const scene = SCENE_FOR_SERVICE[service.slug] ?? "siding";
  const hasPrice = service.starting_price != null && service.pricing_model !== "quote_only";

  return (
    <article
      id={service.slug}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition-shadow hover:shadow-lift"
    >
      <div className="aspect-[16/9] border-b border-line">
        <Scene kind={scene} state="after" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-ink-900">{service.name}</h3>
          <span className="whitespace-nowrap rounded-md bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
            {hasPrice ? `From $${service.starting_price}` : "Free estimate"}
          </span>
        </div>

        <p className="mt-3 text-body-muted">
          {detailed ? service.description : `${service.description.split(". ")[0]}.`}
        </p>

        {detailed ? (
          <ul className="mt-4 space-y-2">
            {service.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 text-sm text-body-muted">
          {hasPrice ? formatServicePrice(service) : "Priced after we see the property"} &middot; about{" "}
          {Math.round(service.duration_minutes / 60)} hours on site
        </p>

        <Link
          href={`/book?service=${service.slug}`}
          className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"
        >
          Get a price for {service.name.toLowerCase()}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function ServicesGrid({ services, detailed = false }: { services: Service[]; detailed?: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} detailed={detailed} />
      ))}
    </div>
  );
}
