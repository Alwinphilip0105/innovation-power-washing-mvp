"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server details stay on the server; the digest is the handle for support.
    console.error("[app] unhandled render error", { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-4 text-center">
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Something went wrong</h1>
      <p className="mt-3 max-w-md text-body-muted">
        We hit an unexpected error. Try again, and if it keeps happening give the office a call and
        quote this reference.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-body-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Back to the website
        </ButtonLink>
      </div>
    </div>
  );
}
