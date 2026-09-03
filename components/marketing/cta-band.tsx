import { Phone } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

export function CtaBand({
  phoneDisplay,
  phoneHref,
  heading = "Ready to see what is under all that?",
  body = "Free written estimate, no obligation, and no high-pressure sales visit. Most homes are quoted the same day.",
}: {
  phoneDisplay: string;
  phoneHref: string;
  heading?: string;
  body?: string;
}) {
  return (
    <section className="bg-brand-600 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{heading}</h2>
          <p className="mt-3 text-lg text-white/85">{body}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/book" size="lg" className="sm:min-w-56">
            Get a Free Estimate
          </ButtonLink>
          <a
            href={phoneHref}
            className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-white px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white hover:text-brand-700 sm:text-lg"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            {phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
