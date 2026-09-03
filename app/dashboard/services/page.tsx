import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { requireAuth } from "@/lib/auth";
import { getAllServices } from "@/services/business";

export const metadata: Metadata = { title: "Services" };

const PRICING_LABEL: Record<string, string> = {
  starting_at: "Starting at",
  per_sqft: "Per square foot",
  flat: "Flat rate",
  quote_only: "Quote only",
};

export default async function ServicesPage() {
  const { business } = await requireAuth("/dashboard/services");
  const services = await getAllServices(business.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Services</h1>
        <p className="text-body-muted">
          These records are the single source of truth for pricing. The website, the booking page and
          the assistant all read from here.
        </p>
      </div>

      <Alert tone="info" title="Pricing safety">
        The assistant may only quote the exact starting price stored here. A service with no price is
        never guessed at - it raises an estimate request instead.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <Card key={service.id}>
            <CardHeader
              title={service.name}
              description={`Slug: ${service.slug}`}
              action={
                service.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Hidden</Badge>
              }
            />
            <CardBody className="space-y-3">
              <p className="text-body-muted">{service.description}</p>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-ink-900">Pricing model</dt>
                  <dd className="text-body-muted">
                    {PRICING_LABEL[service.pricing_model] ?? service.pricing_model}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-900">Configured price</dt>
                  <dd className="text-body-muted">
                    {service.starting_price != null ? `$${service.starting_price}` : "None (quote only)"}
                    {service.price_unit ? ` ${service.price_unit}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-900">Job length</dt>
                  <dd className="text-body-muted">{service.duration_minutes} minutes</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-900">Sort order</dt>
                  <dd className="text-body-muted">{service.sort_order}</dd>
                </div>
              </dl>

              <div>
                <p className="text-sm font-semibold text-ink-900">Marketing highlights</p>
                <ul className="mt-1 list-inside list-disc text-sm text-body-muted">
                  {service.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
