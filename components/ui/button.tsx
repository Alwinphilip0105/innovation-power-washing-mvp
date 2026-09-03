import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-amber-cta text-white hover:bg-amber-cta-dark shadow-sm",
  secondary: "bg-ink-900 text-white hover:bg-ink-800",
  outline: "border-2 border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-white",
  ghost: "text-ink-900 hover:bg-surface-muted",
  danger: "bg-bad text-white hover:brightness-90",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[0.95rem]",
  lg: "px-6 py-3.5 text-base sm:text-lg",
};

export interface ButtonStyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyleProps = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps & { children: ReactNode }) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps & { children: ReactNode }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
