import { CalendarCheck, Leaf, ShieldCheck, Sparkles } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, title: "Fully insured", detail: "Proof of insurance on request" },
  { icon: Leaf, title: "Careful with plants", detail: "Landscaping protected on every job" },
  { icon: CalendarCheck, title: "On-time crews", detail: "Confirmed in advance, often early" },
  { icon: Sparkles, title: "Free estimates", detail: "Text, talk on the phone, get a quote" },
];

export function TrustBar() {
  return (
    <section className="border-b border-line bg-surface-muted" aria-label="Why homeowners trust us">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-6 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="rounded-md bg-brand-50 p-2 text-brand-600">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-sm font-bold text-ink-900">{title}</span>
              <span className="block text-sm text-body-muted">{detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
