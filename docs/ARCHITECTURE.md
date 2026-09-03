# Architecture

## The shape of the problem

A local service business loses money in three places: calls it does not answer,
enquiries it does not follow up, and quotes it does not send. All three happen
outside business hours or while the crew is on a roof. This platform sits in
front of those three gaps with one assistant that works across every channel,
and a CRM that gives the owner one place to look.

## Technology decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | Server components put data access on the server by default; route handlers cover the API without a second service. |
| Backend | Route handlers + a service layer | A modular monolith. Fewer moving parts than microservices, and the seams are already drawn if a piece needs extracting. |
| Database | Postgres via Supabase | Relational data with real constraints, plus RLS and Auth without building either. |
| Validation | Zod v4 | One schema module used by forms, API routes, webhooks and AI tool calls. |
| Styling | Tailwind v4 | Tokens in `app/globals.css`, no runtime CSS-in-JS. |
| Tests | Vitest + Playwright | Vitest for logic and service integration with no network; Playwright for the journeys that only matter in a browser. |

## The central idea: provider seams

Every external capability is an interface with a mock implementation selected by
environment variable. Application code depends on the interface; it never
imports a vendor SDK.

```
                 ┌──────────────────────────────────────────┐
  Website ─┐     │            Service layer                 │
  Chat ────┼────►│  leads · appointments · conversations    │
  SMS ─────┤     │  calls · estimates · customers           │
  Voice ───┘     └───────┬──────────────────────────┬───────┘
                         │                          │
                 ┌───────▼────────┐        ┌────────▼────────┐
                 │  DataStore     │        │  Providers      │
                 │  memory │ supa │        │  AI · SMS ·     │
                 └────────────────┘        │  voice · email ·│
                                           │  booking        │
                                           └─────────────────┘
```

Three things fall out of this:

1. **The product runs with zero credentials.** `npm run dev` exercises every
   path — including tool calls, bookings and webhooks — against mocks.
2. **Tests are fast and hermetic.** The integration suite drives the real
   service layer with no network.
3. **Swapping a vendor is a provider change**, not an application change.

| Capability | Interface | Implementations |
|---|---|---|
| Data | `lib/db/store.ts` → `DataStore` | `MemoryStore`, `SupabaseStore` |
| AI | `lib/ai/types.ts` → `AIProvider` | `MockAIProvider`, `AnthropicAIProvider` |
| Booking | `lib/booking/provider.ts` → `BookingProvider` | `InternalBookingProvider` (+ `CalendarClient` adapters) |
| SMS | `lib/sms/provider.ts` → `SmsProvider` | `MockSmsProvider`, `TwilioSmsProvider` |
| Voice | `lib/voice/provider.ts` → `VoiceProvider` | `MockVoiceProvider`, vendor seats |
| Email | `lib/notifications/provider.ts` → `EmailProvider` | `MockEmailProvider`, `ResendEmailProvider` |

## Layers

```
app/          routing, rendering, HTTP. No business rules.
services/     business operations. The only place workflows live.
lib/          capabilities: providers, validation, events, auth, logging.
```

The rule: a route handler validates input, calls one service function, and maps
the result to a response. If a route handler is making decisions, it belongs in
`services/`.

## Data flow

### Website lead

```
form → POST /api/leads
     → rate limit + honeypot + Zod
     → captureWebsiteLead()
     → findOrCreateCustomer()      dedupe on phone, then email
     → upsertCustomerAddress()
     → createLead()                priced from the service record
     → emit("lead.created")
     → notifyOwner()               in-app notification + email
```

### Assistant turn (identical for web chat, SMS and phone)

```
message → runAssistantTurn()
        → persist inbound message
        → buildSystemPrompt(business, services, channel)
        → provider.respond()
        → executeTool()  ×N        validate → authorize → service layer → DB
        → persist outbound message
```

The loop is capped at five tool iterations. Every tool call is written to
`ai_actions` whether it succeeded or not.

### Booking

```
GET /api/availability   → computeAvailability()   business hours × rules × existing jobs
POST /api/appointments  → checkSlot()             re-validated server-side
                        → createAppointment()
                        → lead → "booked"
                        → emit("appointment.created")
                        → confirmation SMS + owner notification
```

Availability is never trusted from the client. A slot that was open when the
page loaded is re-checked at booking time and rejected with a machine-readable
code if it has gone.

### Missed call

```
webhook → verify signature → idempotency check → recordVoiceEvent()
        → emit("call.missed")
        → ensureLeadForCall()      customer + lead created
        → follow-up SMS
        → owner notification
```

The customer's reply arrives on `/api/webhooks/sms` and runs through the same
assistant, so a missed call becomes a qualified lead without anyone picking up.

## Multi-tenancy

Every business-owned table carries `business_id`. The two that do not
(`addresses`, `messages`) reach it through exactly one parent. Every `DataStore`
method takes a business id; there is no method that reads a row without a tenant
scope.

The tenant is resolved at the edge by `services/business.ts`. Today it resolves
the default slug; changing that to resolve from hostname or path is a change to
one function, not to any caller.

## Events and automations

`lib/events/bus.ts` is a typed in-process emitter. Handlers are registered once
at startup by `lib/bootstrap.ts`.

| Event | Automation |
|---|---|
| `lead.created` | Owner notification + email |
| `appointment.created` | Customer confirmation SMS + owner notification |
| `appointment.cancelled` | Owner notification |
| `call.missed` | Lead created, follow-up SMS, owner notification |
| `estimate.requested` | Owner notification |
| `escalation.required` | Conversation flagged, owner notification |
| `lead.status_changed` | Analytics event |

A handler that throws is logged and the others still run — a failing follow-up
email must never roll back the lead that caused it. No external workflow tool is
required; the shape is queue-compatible if one is added later.

## Security model

Summarised here, detailed in [SECURITY.md](SECURITY.md).

- Untrusted input is parsed by Zod before it reaches any store.
- Authorization is ours: the session cookie carries the business id, and every
  query is scoped by it. RLS is defence in depth for direct database access.
- Secrets are server-only. Nothing secret is prefixed `NEXT_PUBLIC_`.
- Webhooks are signature-verified and idempotent.
- Internal error detail goes to the log with a request id; the client gets an
  opaque message.
- The AI never touches the database. It calls schema-validated tools that run
  under the caller's business scope, and every call is audited.

## Deployment model

Vercel. Static marketing pages are prerendered; the dashboard, API routes and
webhooks are server-rendered on demand. The only stateful dependency is the data
store.

**Known limitation:** the in-memory store is per-process, so on serverless a
write in one invocation may not be visible to the next. It is the right default
for local development and a self-contained demo; anything that must persist
needs Supabase configured.

## MVP scope

**In:** marketing website; lead capture from web, chat and SMS; AI assistant
with tool calling across three channels; availability and booking with
double-booking prevention; CRM with lead detail and status management;
appointments, conversations, calls and estimates views; owner notifications;
missed-call recovery; audit trail; multi-tenant schema with RLS.

**Deliberately out:** payment processing, real telephony, review generation,
marketing automation, multi-location scheduling, a customer-facing portal.

**Deliberately not faked:** the Google Calendar / Cal.com / Calendly and
Vapi / Retell / Twilio-voice adapters are declared seats that fail loudly. In a
system that books real appointments, an integration that silently pretends to
work is worse than one that refuses.
