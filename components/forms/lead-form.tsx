"use client";
import { apiUrl } from "@/lib/api/client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useRequestedService } from "@/lib/hooks/use-requested-service";

export interface LeadFormService {
  slug: string;
  name: string;
}

interface SuccessState {
  firstName: string;
  serviceName: string;
}

const FIELD_IDS = {
  firstName: "lead-first-name",
  lastName: "lead-last-name",
  phone: "lead-phone",
  email: "lead-email",
  street: "lead-street",
  city: "lead-city",
  zip: "lead-zip",
  serviceSlug: "lead-service",
  preferredDate: "lead-date",
  notes: "lead-notes",
} as const;

export function LeadForm({
  services,
  phoneDisplay,
  compact = false,
}: {
  services: LeadFormService[];
  phoneDisplay: string;
  compact?: boolean;
}) {
  const requestedSlug = useRequestedService(services);
  const selectedService = requestedSlug ?? services[0]?.slug;

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<SuccessState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch(apiUrl("/api/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        fields?: Record<string, string>;
        data?: { serviceName: string | null };
      };

      if (!response.ok || !payload.ok) {
        setFieldErrors(payload.fields ?? {});
        setFormError(payload.error ?? "We could not submit that. Please try again.");
        return;
      }

      setSuccess({
        firstName: String(data.firstName ?? "there"),
        serviceName: payload.data?.serviceName ?? "your service",
      });
      form.reset();
    } catch {
      setFormError(
        `We could not reach our system just now. Please call us at ${phoneDisplay} and we will take your details over the phone.`,
      );
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border-2 border-good/40 bg-good-soft p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-good" aria-hidden="true" />
        <h3 className="mt-3 font-display text-2xl font-extrabold text-ink-900">
          Thanks, {success.firstName} - we have your request.
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-body">
          Your {success.serviceName.toLowerCase()} request is in front of the office now. Someone will
          call you within one business day to confirm the details and lock in a date. If you need us
          sooner, call {phoneDisplay}.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-5 text-sm font-semibold text-brand-600 underline"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="bad" title="We could not submit that">{formError}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor={FIELD_IDS.firstName} required error={fieldErrors.firstName}>
          <Input
            id={FIELD_IDS.firstName}
            name="firstName"
            autoComplete="given-name"
            required
            invalid={Boolean(fieldErrors.firstName)}
          />
        </Field>
        <Field label="Last name" htmlFor={FIELD_IDS.lastName} required error={fieldErrors.lastName}>
          <Input
            id={FIELD_IDS.lastName}
            name="lastName"
            autoComplete="family-name"
            required
            invalid={Boolean(fieldErrors.lastName)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone"
          htmlFor={FIELD_IDS.phone}
          required
          hint="We text a confirmation before we come out."
          error={fieldErrors.phone}
        >
          <Input
            id={FIELD_IDS.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(973) 750-8757"
            required
            invalid={Boolean(fieldErrors.phone)}
          />
        </Field>
        <Field label="Email" htmlFor={FIELD_IDS.email} required error={fieldErrors.email}>
          <Input
            id={FIELD_IDS.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            invalid={Boolean(fieldErrors.email)}
          />
        </Field>
      </div>

      <Field label="Service address" htmlFor={FIELD_IDS.street} required error={fieldErrors.street}>
        <Input
          id={FIELD_IDS.street}
          name="street"
          autoComplete="street-address"
            placeholder="12 Lakeside Avenue"
          required
          invalid={Boolean(fieldErrors.street)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Town" htmlFor={FIELD_IDS.city} required error={fieldErrors.city}>
          <Input
            id={FIELD_IDS.city}
            name="city"
            autoComplete="address-level2"
            placeholder="Pompton Lakes"
            required
            invalid={Boolean(fieldErrors.city)}
          />
        </Field>
        <Field label="ZIP code" htmlFor={FIELD_IDS.zip} required error={fieldErrors.zip}>
          <Input
            id={FIELD_IDS.zip}
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="07442"
            required
            invalid={Boolean(fieldErrors.zip)}
          />
        </Field>
      </div>
      <input type="hidden" name="state" value="NJ" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What needs cleaning?" htmlFor={FIELD_IDS.serviceSlug} required error={fieldErrors.serviceSlug}>
          <Select
            id={FIELD_IDS.serviceSlug}
            name="serviceSlug"
            // Remounts the uncontrolled select when `?service=` resolves
            // after hydration; without the key its defaultValue is fixed.
            key={selectedService}
            defaultValue={selectedService}
            required
            invalid={Boolean(fieldErrors.serviceSlug)}
          >
            {services.map((service) => (
              <option key={service.slug} value={service.slug}>
                {service.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Preferred date"
          htmlFor={FIELD_IDS.preferredDate}
          hint="Optional - we will confirm what is actually open."
          error={fieldErrors.preferredDate}
        >
          <Input
            id={FIELD_IDS.preferredDate}
            name="preferredDate"
            type="date"
            invalid={Boolean(fieldErrors.preferredDate)}
          />
        </Field>
      </div>

      {compact ? null : (
        <Field
          label="Anything we should know?"
          htmlFor={FIELD_IDS.notes}
          hint="Gate codes, problem areas, two-story vs ranch - anything helps."
          error={fieldErrors.notes}
        >
          <Textarea id={FIELD_IDS.notes} name="notes" rows={4} invalid={Boolean(fieldErrors.notes)} />
        </Field>
      )}

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="lead-company">Company (leave blank)</label>
        <input id="lead-company" name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Sending your request...
          </>
        ) : (
          "Get My Free Estimate"
        )}
      </Button>

      <p className="flex items-start gap-2 text-xs text-body-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
        No obligation, no high-pressure sales visit. We use your details to quote and schedule your job,
        nothing else.
      </p>
    </form>
  );
}
