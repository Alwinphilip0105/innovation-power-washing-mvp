import { cn } from "@/lib/utils/cn";

/** Wordmark + spray-nozzle mark. Inline SVG so it never depends on an asset. */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const primary = inverted ? "#ffffff" : "#0b2545";
  const accent = inverted ? "#7cc0f5" : "#1667c0";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 44 44" className="h-10 w-10 shrink-0" aria-hidden="true">
        <circle cx="22" cy="22" r="21" fill={primary} />
        <path d="M13 27 C13 20 22 11 22 11 C22 11 31 20 31 27 A9 9 0 0 1 13 27 Z" fill={accent} />
        <path d="M18.5 25.5 C18.5 22 22 17.5 22 17.5 C22 17.5 25.5 22 25.5 25.5 A3.5 3.5 0 0 1 18.5 25.5 Z" fill="#ffffff" opacity="0.9" />
      </svg>
      <span className="leading-none">
        <span
          className="block font-display text-[1.05rem] font-extrabold uppercase tracking-[0.06em]"
          style={{ color: primary }}
        >
          Innovation
        </span>
        <span
          className="block font-display text-[0.7rem] font-bold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          Power Washing
        </span>
      </span>
    </span>
  );
}
