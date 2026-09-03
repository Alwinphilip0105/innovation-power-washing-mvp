import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "info" | "good" | "warn" | "bad" | "dark";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-body-muted",
  info: "bg-brand-50 text-brand-700",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  dark: "bg-ink-900 text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
