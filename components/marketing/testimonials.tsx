import { Quote, Star } from "lucide-react";

import type { Testimonial } from "@/lib/config/content";

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.name + item.quote.slice(0, 12)}
          className="flex flex-col rounded-lg border border-line bg-surface p-6 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="flex" aria-label="Five out of five stars">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-amber-cta text-amber-cta" aria-hidden="true" />
              ))}
            </span>
            <Quote className="ml-auto h-6 w-6 text-brand-100" aria-hidden="true" />
          </div>
          <blockquote className="mt-4 flex-1 text-body">
            <p>&ldquo;{item.quote}&rdquo;</p>
          </blockquote>
          <footer className="mt-5 border-t border-line pt-4 text-sm">
            <p className="font-bold text-ink-900">{item.name}</p>
            <p className="text-body-muted">
              {item.town}, NJ &middot; {item.service}
            </p>
          </footer>
        </li>
      ))}
    </ul>
  );
}
