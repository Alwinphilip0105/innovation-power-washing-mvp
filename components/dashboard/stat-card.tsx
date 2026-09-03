import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "alert" | "good";
}) {
  const tones = {
    default: "text-brand-600 bg-brand-50",
    alert: "text-bad bg-bad-soft",
    good: "text-good bg-good-soft",
  } as const;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-body-muted">{label}</p>
        <span className={cn("rounded-md p-2", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold text-ink-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-body-muted">{detail}</p> : null}
    </>
  );

  const className =
    "block rounded-lg border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-lift";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
