import type { Metadata } from "next";

import { VoiceDemo } from "@/components/demo/voice-demo";
import { serverHref } from "@/lib/api/client";
import { getActiveServices, getCurrentBusiness } from "@/services/business";
import { voiceGreeting } from "@/services/voice-demo";

export const metadata: Metadata = {
  title: "AI phone agent — live demo",
  description: "Talk to the AI phone agent in your browser. It books a real appointment.",
  robots: { index: false, follow: false },
};

const TALKING_POINTS = [
  {
    title: "It quotes the real price list",
    body: "Prices come from the services table, not from the model. A service priced by estimate is never given a number.",
  },
  {
    title: "It offers real openings",
    body: "Every time it suggests is a genuinely free slot inside business hours, checked against the calendar as you speak.",
  },
  {
    title: "It books, and the booking is real",
    body: "A confirmed time writes a customer, a lead and an appointment. If the booking fails it says so rather than pretending.",
  },
  {
    title: "It hands off when it should",
    body: "A complaint or a request for a person stops the sales path and notifies the owner instead.",
  },
];

export default async function VoiceDemoPage() {
  const business = await getCurrentBusiness();
  const services = await getActiveServices(business.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="font-semibold uppercase tracking-wide text-brand-600">Live demo</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink-900 sm:text-4xl">
          Talk to the AI phone agent
        </h1>
        <p className="mt-3 max-w-2xl text-body-muted">
          This is the agent that answers the phone for {business.name}, running in your browser. Your
          browser does the listening and the speaking; everything after that is the production
          system, so a job booked here is a real job on the real calendar.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <VoiceDemo
          assistantName={business.settings.ai.assistantName}
          businessName={business.name}
          greeting={voiceGreeting(business)}
        />

        <aside className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display font-bold text-ink-900">Try saying</h2>
            <ul className="mt-3 space-y-2 text-sm text-body-muted">
              <li>&ldquo;Hi, how much would it cost to wash my house?&rdquo;</li>
              <li>&ldquo;It&rsquo;s a two storey colonial in Wayne.&rdquo;</li>
              <li>&ldquo;What have you got open next week?&rdquo;</li>
              <li>&ldquo;Thursday morning works. It&rsquo;s Dana Reyes, 973 555 0134.&rdquo;</li>
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display font-bold text-ink-900">What to watch for</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {TALKING_POINTS.map((point) => (
                <div key={point.title}>
                  <dt className="font-semibold text-body">{point.title}</dt>
                  <dd className="text-body-muted">{point.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-line bg-surface-muted p-5 text-sm text-body-muted">
            <h2 className="font-display font-bold text-ink-900">The honest caveats</h2>
            <ul className="mt-3 space-y-2">
              <li>
                Speaking and listening need Chrome or Edge, and Chrome sends the audio to Google to
                transcribe it. Any other browser can still type.
              </li>
              <li>
                Nobody is dialling a number. Real telephony needs a voice vendor and a phone line;
                this demonstrates the agent, not the phone system.
              </li>
              <li>
                It currently covers {services.length} services from the live price list.
              </li>
            </ul>
            <a
              href={serverHref("/dashboard/calls")}
              className="mt-4 inline-block font-semibold text-brand-600 underline underline-offset-2"
            >
              See past calls in the dashboard
            </a>
          </section>
        </aside>
      </div>
    </main>
  );
}
