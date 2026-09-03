import Link from "next/link";

import { Logo } from "@/components/marketing/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-4 text-center">
      <Link href="/">
        <Logo />
      </Link>
      <p className="mt-10 font-display text-6xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ink-900">
        That page is not here
      </h1>
      <p className="mt-3 max-w-md text-body-muted">
        The link may be old or mistyped. Everything we offer is one click away below.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back to the website</ButtonLink>
        <ButtonLink href="/book" variant="outline">
          Get a free estimate
        </ButtonLink>
      </div>
    </div>
  );
}
