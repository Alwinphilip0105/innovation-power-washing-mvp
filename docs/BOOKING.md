# Booking

## Provider abstraction

Business logic depends on `BookingProvider` (`lib/booking/provider.ts`), never on
a calendar vendor:

```ts
interface BookingProvider {
  getAvailability(input): Promise<AvailabilityDay[]>;
  createAppointment(input): Promise<Appointment>;
  cancelAppointment(business, appointmentId, reason?): Promise<Appointment>;
  rescheduleAppointment(input): Promise<Appointment>;
}
```

`InternalBookingProvider` is the only implementation, and **our own calendar is
always the source of truth**. Appointments live in our tables and conflict
checks run against our rows. An optional `CalendarClient` mirrors each booking
out to an external calendar; if that mirror fails, the appointment is already
saved and the failure is logged. A calendar outage must never surface to a
customer as a failed booking.

`BOOKING_PROVIDER` selects the mirror: `internal` (a mock client in development,
none in production), or `google` / `calcom` / `calendly`. The three vendor
adapters are **declared seats that throw a descriptive error**. This build has
no accounts to test against, and untested integration code that silently drops
appointments is worse than an explicit failure. Each error names the API to
implement and tells you to set `BOOKING_PROVIDER=internal` meanwhile.

## The rules

Configured per business in `settings.bookingRules`, visible at
`/dashboard/settings`:

| Rule | Default | Effect |
|---|---|---|
| `minNoticeMinutes` | 720 (12h) | Earliest bookable slot from now |
| `maxAdvanceDays` | 45 | Booking horizon |
| `slotIntervalMinutes` | 60 | Grid the availability search walks |
| `bufferMinutes` | 30 | Travel/cleanup padding around each job |
| `maxConcurrentAppointments` | 2 | Crews that can run at once |

Plus `business_hours` per weekday, and the service's own `duration_minutes` —
the job length comes from the service record, never from the caller.

## `checkSlot` — one gate, every path

`lib/booking/availability.ts` is pure and has no store dependency. Every booking
path goes through it: the website, the dashboard, the AI tool call and the
webhook alike.

```ts
checkSlot({ business, start, durationMinutes, busy, now }): BookingError | null
```

Checked in order, returning the first failure:

| Code | Meaning |
|---|---|
| `invalid_duration` | Not a positive number, or over 12 hours |
| `invalid_time` | Unparseable instant |
| `too_soon` | Inside the notice window |
| `too_far_out` | Beyond the horizon |
| `outside_business_hours` | Does not fit inside an opening window |
| `slot_unavailable` | Concurrent-crew limit reached |

The code is machine-readable so the web form, the dashboard and the assistant
can each phrase the refusal correctly instead of guessing.

## Double-booking prevention

`countConflicts()` expands every existing appointment by `bufferMinutes` on both
sides, then counts half-open interval overlaps. A slot is refused once the count
reaches `maxConcurrentAppointments`.

Only `requested` and `confirmed` appointments occupy a slot. Cancelling frees it
immediately.

**The client is never trusted.** `GET /api/availability` returns what is open
now; `POST /api/appointments` re-runs `checkSlot` against fresh rows at booking
time. A slot that was open when the page loaded and has since gone is rejected
with `409` and the UI refreshes the grid.

## Timezones

Instants are stored and passed as UTC ISO strings. Business hours are wall-clock
times in the business's IANA zone. Conversion uses `Intl` in
`lib/utils/datetime.ts` — no date library, and no dependence on the server's
local timezone.

`zonedTimeToUtc` refines its offset twice so DST transitions resolve correctly.
`tests/unit/availability.test.ts` asserts that 8:00 AM on the Monday after the
spring-forward date is still 8:00 AM local, and lands on the right UTC instant.

## The customer flow

`components/booking/booking-flow.tsx`:

1. Pick a service (name, quote-only or starting price, approximate duration).
2. Real openings load from `/api/availability`, grouped by day and labelled in
   the business timezone. Taken slots never appear.
3. Pick a time — it is held in the UI, not reserved server-side.
4. Enter details. Submitting posts to `/api/appointments`, which de-duplicates
   the customer on phone, attaches the address, creates the lead, and books.
5. Confirmation shows the booked time in the business timezone.

If the slot went while the form was being filled in, the error is shown and the
grid reloads.

## What booking triggers

```
bookAppointment()
  → provider.createAppointment()   checkSlot re-run, row written
  → lead → "booked"
  → emit("appointment.created")
       → confirmation SMS to the customer, recorded on the SMS thread
       → owner notification + email
```

`setAppointmentStatus(..., "completed")` also completes the linked lead.
Cancelling emits `appointment.cancelled` and appends the reason to the notes.

## Extending

**A real calendar:** implement `CalendarClient` (`createEvent`, `cancelEvent`,
`moveEvent`) and register it in `lib/booking/calendar-clients.ts`. Keep the
internal calendar authoritative; the external one is a mirror.

**Per-crew scheduling:** today capacity is a single `maxConcurrentAppointments`
number. Real crew assignment means a `crews` table and a crew dimension in
`countConflicts`. The seam is `busy` — currently every blocking appointment;
it would become the busy set for a specific crew.

**Reminders:** add a scheduled job that queries appointments in a window and
emits a reminder event. The automation layer already handles delivery.
