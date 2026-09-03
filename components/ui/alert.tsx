import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone = "info" | "good" | "warn" | "bad";

const tones: Record<Tone, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-700",
  good: "border-good/30 bg-good-soft text-good",
  warn: "border-warn/30 bg-warn-soft text-warn",
  bad: "border-bad/30 bg-bad-soft text-bad",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
