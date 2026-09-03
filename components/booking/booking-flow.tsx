"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

export interface BookableService {
  slug: string;
  name: string;
  durationMinutes: number;
  startingPrice: number | null;
  quoteOnly: boolean;
}

interface Slot {
  start: string;
  time: string;
  label: string;
}

interface Day {
  date: string;
  weekday: string;
  slots: Slot[];
}

interface Confirmation {
  when: string;
  serviceName: string;
  firstName: string;
}

const DAY_LABEL: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function formatDay(day: Day): string {
  const [year, month, date] = day.date.split("-").map(Number);
  const formatted = new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${DAY_LABEL[day.weekday] ?? day.weekday}, ${formatted}`;
}

export function BookingFlow({
  services,
  defaultServiceSlug,
  phoneDisplay,
  timezoneLabel,
}: {
  services: BookableService[];
  defaultServiceSlug?: string;
  phoneDisplay: string;
  timezoneLabel: string;
}) {
  const [serviceSlug, setServiceSlug] = useState(defaultServiceSlug ?? services[0]?.slug ?? "");
  const [days, setDays] = useState<Day[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  /** Bumped to force a refetch after a slot is lost to someone else. */
  const [refreshToken, setRefreshToken] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const service = services.find((candidate) => candidate.slug === serviceSlug);

  // Availability is external state: the effect only subscribes to it, and every
  // state write happens after the request resolves.
  useEffect(() => {
    if (!serviceSlug) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/availability?serviceSlug=${encodeURIComponent(serviceSlug)}&days=10`,
        );
        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: { days: Day[] };
        };
        if (cancelled) return;

        if (!response.ok || !payload.ok || !payload.data) {
          setSlotError(payload.error ?? "We could not load the schedule just now.");
          setDays([]);
        } else {
          setSlotError(null);
          setDays(payload.data.days.filter((day) => day.slots.length > 0));
        }
      } catch {
        if (cancelled) return;
        setSlotError("We could not load the schedule. Please call the office and we will book you in.");
        setDays([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serviceSlug, refreshToken]);

  function selectService(slug: string) {
    if (slug === serviceSlug) return;
    setServiceSlug(slug);
    setSelected(null);
    setSlotError(null);
    setLoadingSlots(true);
  }

  function refreshAvailability() {
    setSelected(null);
    setLoadingSlots(true);
    setRefreshToken((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !selected || !service) return;

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSlug,
          startTime: selected.start,
          notes: data.notes || undefined,
          customer: {
            firstName: data.firstName,
            lastName: data.lastName || undefined,
            phone: data.phone,
            email: data.email || undefined,
          },
          address: {
            street: data.street,
            city: data.city,
            state: "NJ",
            zip: data.zip,
          },
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        fields?: Record<string, string>;
        data?: { when: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        setFieldErrors(payload.fields ?? {});
        setFormError(payload.error ?? "We could not complete that booking.");
        // The slot may have just been taken - refresh what is actually open.
        refreshAvailability();
        return;
      }

      setConfirmation({
        when: payload.data.when,
        serviceName: service.name,
        firstName: data.firstName,
      });
    } catch {
      setFormError(
        `We could not reach our scheduling system. Please call ${phoneDisplay} and we will book you in.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <div className="rounded-lg border-2 border-good/40 bg-good-soft p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-good" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl font-extrabold text-ink-900">
          You&apos;re on the schedule, {confirmation.firstName}.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-body">
          {confirmation.serviceName} on <strong>{confirmation.when}</strong>. We have sent a text
          confirmation, and the office will call to run through access and any problem areas before
          the day.
        </p>
        <p className="mt-4 text-sm text-body-muted">
          Need to change it? Call {phoneDisplay} - cancellations are free up to 24 hours before.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="pick-service">
        <h2 id="pick-service" className="font-display text-xl font-bold text-ink-900">
          1. What needs cleaning?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((candidate) => {
            const active = candidate.slug === serviceSlug;
            return (
              <button
                key={candidate.slug}
                type="button"
                onClick={() => selectService(candidate.slug)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  active
                    ? "border-brand-500 bg-brand-50"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="block font-display font-bold text-ink-900">{candidate.name}</span>
                <span className="mt-1 block text-sm text-body-muted">
                  {candidate.quoteOnly || candidate.startingPrice == null
                    ? "Quoted after a look"
                    : `From $${candidate.startingPrice}`}{" "}
                  &middot; approx. {Math.round(candidate.durationMinutes / 60)} hrs
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pick-time">
        <h2 id="pick-time" className="font-display text-xl font-bold text-ink-900">
          2. Pick a time that works
        </h2>
        <p className="mt-1 text-sm text-body-muted">
          These are our real openings, shown in {timezoneLabel}. Taken slots never appear here.
        </p>

        <div className="mt-4">
          {loadingSlots ? (
            <p className="flex items-center gap-2 text-body-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Checking the schedule...
            </p>
          ) : slotError ? (
            <Alert tone="bad">{slotError}</Alert>
          ) : days.length === 0 ? (
            <Alert tone="warn" title="Nothing open in the next few days">
              Call {phoneDisplay} or send us your details and we will get you into the next opening.
            </Alert>
          ) : (
            <div className="space-y-4">
              {days.slice(0, 6).map((day) => (
                <div key={day.date}>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-body-muted">
                    {formatDay(day)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {day.slots.map((slot) => {
                      const active = selected?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelected(slot)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-md border-2 px-4 py-2 text-sm font-semibold transition-colors",
                            active
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-line-strong bg-surface text-ink-900 hover:border-brand-400",
                          )}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="your-details">
        <h2 id="your-details" className="font-display text-xl font-bold text-ink-900">
          3. Your details
        </h2>

        {selected ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Holding {service?.name} on {selected.label}
          </p>
        ) : (
          <p className="mt-2 text-sm text-body-muted">Choose a time above to continue.</p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError ? <Alert tone="bad" title="We could not book that">{formError}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="bk-first" required error={fieldErrors["customer.firstName"]}>
              <Input id="bk-first" name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label="Last name" htmlFor="bk-last" error={fieldErrors["customer.lastName"]}>
              <Input id="bk-last" name="lastName" autoComplete="family-name" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="bk-phone" required error={fieldErrors["customer.phone"]}>
              <Input
                id="bk-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(973) 750-8757"
                required
              />
            </Field>
            <Field label="Email" htmlFor="bk-email" error={fieldErrors["customer.email"]}>
              <Input id="bk-email" name="email" type="email" autoComplete="email" />
            </Field>
          </div>

          <Field label="Service address" htmlFor="bk-street" required error={fieldErrors["address.street"]}>
            <Input id="bk-street" name="street" autoComplete="street-address" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Town" htmlFor="bk-city" required error={fieldErrors["address.city"]}>
              <Input id="bk-city" name="city" autoComplete="address-level2" required />
            </Field>
            <Field label="ZIP" htmlFor="bk-zip" required error={fieldErrors["address.zip"]}>
              <Input id="bk-zip" name="zip" inputMode="numeric" autoComplete="postal-code" required />
            </Field>
          </div>

          <Field
            label="Anything we should know?"
            htmlFor="bk-notes"
            hint="Gate codes, pets, problem areas, where the outdoor spigot is."
            error={fieldErrors.notes}
          >
            <Textarea id="bk-notes" name="notes" rows={3} />
          </Field>

          <Button type="submit" size="lg" className="w-full" disabled={submitting || !selected}>
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Booking your slot...
              </>
            ) : (
              "Confirm this appointment"
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
