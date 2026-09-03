import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "surface",
  className,
  center = false,
  headingLevel = 2,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  intro?: ReactNode;
  children?: ReactNode;
  tone?: "surface" | "muted" | "dark";
  className?: string;
  center?: boolean;
  /**
   * A page's opening section carries its `h1`; every later section is an `h2`.
   * Without this every subpage would ship with no level-1 heading at all,
   * which costs both screen-reader navigation and search ranking.
   */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const tones = {
    surface: "bg-surface",
    muted: "bg-surface-muted",
    dark: "bg-ink-900 text-white",
  } as const;

  return (
    <section id={id} className={cn("py-14 sm:py-20", tones[tone], className)}>
      <div className="mx-auto max-w-6xl px-4">
        {(eyebrow || title || intro) && (
          <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
            {eyebrow ? (
              <p
                className={cn(
                  "font-display text-sm font-bold uppercase tracking-[0.18em]",
                  tone === "dark" ? "text-brand-400" : "text-brand-600",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <Heading
                className={cn(
                  "mt-2 text-3xl font-extrabold sm:text-4xl",
                  headingLevel === 1 && "sm:text-5xl",
                  tone === "dark" ? "text-white" : "text-ink-900",
                )}
              >
                {title}
              </Heading>
            ) : null}
            {intro ? (
              <div
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  tone === "dark" ? "text-white/80" : "text-body-muted",
                )}
              >
                {intro}
              </div>
            ) : null}
          </div>
        )}
        {children ? <div className={cn(eyebrow || title || intro ? "mt-10" : "")}>{children}</div> : null}
      </div>
    </section>
  );
}
