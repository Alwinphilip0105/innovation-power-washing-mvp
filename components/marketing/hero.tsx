import { Phone, Star } from "lucide-react";

import { DemoCallButton } from "@/components/demo/demo-call";
import { Scene } from "@/components/graphics/scenes";
import { ButtonLink } from "@/components/ui/button";

export function Hero({
  phoneDisplay,
  phoneHref,
  towns,
}: {
  phoneDisplay: string;
  phoneHref: string;
  towns: string[];
}) {
  return (
    <section className="relative overflow-hidden bg-ink-900 text-white">
      {/* Backdrop illustration, dimmed so the copy stays readable. */}
      <div className="absolute inset-0 opacity-30" aria-hidden="true">
        <Scene kind="siding" state="after" />
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/95 to-ink-900/70"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
            <span className="flex" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-amber-cta text-amber-cta" />
              ))}
            </span>
            Rated 5 stars by neighbors in Pompton Lakes and Wayne
          </p>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
            Your house is not that color.
            <span className="block text-brand-400">It is just dirty.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">
            Professional pressure washing for homes and businesses in Pompton Lakes, Wayne, and
            Pompton Wayne, NJ. Fully insured. Text us, talk on the phone, get a free quote.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg" className="sm:min-w-56">
              Get a Free Estimate
            </ButtonLink>
            <div className="flex flex-col items-stretch gap-1.5">
              <DemoCallButton className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-white/40 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white hover:text-ink-900 sm:text-lg">
                <Phone className="h-5 w-5" aria-hidden="true" />
                Call the AI agent
              </DemoCallButton>
              <a
                href={phoneHref}
                className="text-center text-sm text-white/70 hover:text-white hover:underline"
              >
                or dial {phoneDisplay}
              </a>
            </div>
          </div>

          <p className="mt-6 text-sm text-white/70">
            Serving {towns.join(", ")}.
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-xl border-4 border-white/15 shadow-lift">
            <div className="grid grid-cols-2">
              <figure className="relative">
                <div className="aspect-[4/5]">
                  <Scene kind="siding" state="before" label="Vinyl siding covered in green algae before cleaning" />
                </div>
                <figcaption className="absolute left-2 top-2 rounded bg-ink-950/85 px-2 py-1 text-xs font-bold uppercase tracking-wider">
                  Before
                </figcaption>
              </figure>
              <figure className="relative">
                <div className="aspect-[4/5]">
                  <Scene kind="siding" state="after" label="The same siding after a soft wash" />
                </div>
                <figcaption className="absolute right-2 top-2 rounded bg-brand-500 px-2 py-1 text-xs font-bold uppercase tracking-wider">
                  After
                </figcaption>
              </figure>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-white/70">
            House and patio in Pompton Lakes &middot; finished in an afternoon
          </p>
        </div>
      </div>
    </section>
  );
}
