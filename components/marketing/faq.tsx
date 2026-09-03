import { ChevronDown } from "lucide-react";

import type { FaqEntry } from "@/lib/db/types";

/** Native `details`/`summary`: keyboard accessible and works without JS. */
export function Faq({ faqs }: { faqs: FaqEntry[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-lg border border-line bg-surface">
      {faqs.map((faq) => (
        <details key={faq.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-lg font-bold text-ink-900 hover:bg-surface-muted">
            {faq.question}
            <ChevronDown
              className="h-5 w-5 shrink-0 text-brand-600 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5 text-body-muted">{faq.answer}</div>
        </details>
      ))}
    </div>
  );
}
