# Innovation Power Washing — AI platform for local service businesses

An AI-powered customer acquisition and operations platform. A customer arrives
through the **website, a phone call, or a text**; the same assistant captures the
lead, qualifies it, checks real availability, books the job, and notifies the
owner. The owner works out of a dashboard that shows leads, conversations,
calls, appointments and estimates in one place.

The first tenant is **Innovation Power Washing** (Pompton Lakes / Wayne, NJ), but
nothing about that business is hardcoded — it is seed data, and the platform is
multi-tenant from the first table.

```
Customer → Website / Phone / SMS → AI → Lead → Qualification
        → Appointment → CRM → Owner notification → Follow-up
```

## It runs with no credentials

Every external capability sits behind an interface with a **mock implementation
selected by environment variable**. That means the whole product — website,
chat, booking, CRM, webhooks, notifications — runs locally with no API keys and
no paid services:

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in to the dashboard at [/login](http://localhost:3000/login) with the
seeded owner account (pre-filled in development):

```
owner@innovationpowerwashing.com
powerwash2026
```

The database starts loaded with a realistic demo dataset — leads in every
status, upcoming appointments, past calls with transcripts, and live
conversations — so the dashboard is useful on first load rather than empty.

### Talk to the AI phone agent

[/demo/voice](http://localhost:3000/demo/voice) is a spoken demo that needs no
vendor account, no API key and no phone number: the browser listens and speaks
via the Web Speech API, and everything after that is the production path. A job
booked by voice is a real appointment, and the call lands in the dashboard's
Calls tab with a transcript, a summary and an outcome.

Chrome or Edge to speak; any other browser falls back to typing. See
[docs/VOICE.md](docs/VOICE.md).

## Prerequisites

- **Node.js 20.9+** (Next.js 16 minimum; developed on 24)
- npm 10+
- A Supabase project — **optional**, only for durable storage

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:static` | Static export for GitHub Pages (see `docs/GITHUB_PAGES.md`) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run check` | lint + typecheck + tests, the pre-commit gate |
| `npm run db:seed` | Load the demo dataset into Supabase |
| `npm run format` | Prettier |

## Configuration

Copy `.env.example` to `.env.local`. **Every value is optional.** Fill in only
what you want to switch on; anything left blank falls back to a mock.

| Capability | Default | Switch on with |
|---|---|---|
| Data store | in-memory, seeded | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| AI assistant | deterministic mock | `AI_PROVIDER=anthropic` + `LLM_API_KEY` |
| SMS | mock (logged + recorded) | `SMS_PROVIDER=twilio` + `SMS_PROVIDER_API_KEY` |
| Voice | mock | `VOICE_PROVIDER=…` (adapter seats, see `docs/VOICE.md`) |
| Email | mock (dashboard outbox) | `EMAIL_PROVIDER=resend` + `EMAIL_PROVIDER_API_KEY` |
| Booking | internal calendar | `BOOKING_PROVIDER=…` (see `docs/BOOKING.md`) |
| Auth | dev cookie sign-in | `AUTH_PROVIDER=supabase` + Supabase keys |

`GET /api/health` reports which providers are actually wired, without leaking
any secret.

## Database setup

**The in-memory store is per-process.** It is perfect for local development and
demos, but on a serverless host each invocation may get its own copy, so a lead
submitted on the website may not appear in the dashboard. For anything that
must persist, use Supabase.

1. Create a Supabase project.
2. Apply the migrations — SQL Editor, or `psql`:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
   psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
   ```
3. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
4. Load the demo data:
   ```bash
   npm run db:seed
   ```
5. To use Supabase Auth as well, create a user in the Supabase dashboard and set
   `users.auth_user_id` on the matching row. To keep the simple dev sign-in
   while storing data in Postgres, set `AUTH_PROVIDER=dev`.

Full detail, including the RLS model: `docs/SECURITY.md`.

## Deployment

Vercel, targeting `invpowerwash.alwinphilip.online`. Step by step:
`docs/DEPLOYMENT.md`.

The public site can additionally be served from GitHub Pages. Pages runs no
code, so that build carries the marketing pages and the demos only — the API,
sign-in and the dashboard stay on the Vercel deployment, and the exported pages
call it over `NEXT_PUBLIC_API_BASE_URL`. Both halves have to be up for the demo
to work end to end: `docs/GITHUB_PAGES.md`.

## Testing

```bash
npm test           # 96 unit + integration tests, no network
npm run test:e2e   # browser journeys (needs: npx playwright install chromium)
```

Unit tests cover phone normalization, the booking rule engine (including a DST
boundary), input validation, pricing safety and log redaction. Integration tests
drive the real service layer against the in-memory store: website lead → CRM,
booking → CRM with double-booking rejection, chat → AI → tools → appointment,
missed call → SMS recovery, and webhook idempotency.

## Project structure

```
app/
  (marketing)/    public website
  dashboard/      owner CRM
  api/            route handlers (leads, chat, availability, appointments, webhooks, health)
  login/          staff sign-in
components/       ui/ marketing/ dashboard/ forms/ booking/ chat/ graphics/
lib/
  ai/             provider interface, prompt config, tools, engine
  booking/        availability rules + booking providers
  sms/ voice/ notifications/   channel providers
  db/             DataStore interface, memory + Supabase stores, seed data
  events/         domain event bus and automations
  auth/ validation/ logging/ http/ analytics/ config/
services/         business, customers, leads, appointments, conversations, calls, estimates, dashboard
supabase/migrations/   schema + RLS
tests/            unit/ integration/ e2e/
docs/             architecture and per-subsystem guides
```

## Documentation

| Document | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, MVP scope |
| [docs/AI.md](docs/AI.md) | Assistant, tools, prompt config, pricing safety |
| [docs/BOOKING.md](docs/BOOKING.md) | Availability rules, double-booking prevention |
| [docs/SMS.md](docs/SMS.md) | Inbound/outbound SMS, missed-call recovery |
| [docs/VOICE.md](docs/VOICE.md) | Telephony abstraction and call flow |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, tenant isolation, RLS, webhooks, logging |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel deploy, env vars, domain, troubleshooting |
| [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md) | Serving the public site from GitHub Pages, with the API elsewhere |

## Troubleshooting

**Dashboard is empty / a submitted lead vanished.** You are on the in-memory
store and the process restarted, or you are on serverless. Configure Supabase.

**Cannot sign in.** With `AUTH_PROVIDER=supabase` the Supabase user must exist
*and* the matching `users` row must have `auth_user_id` set. Set
`AUTH_PROVIDER=dev` to fall back to the seeded credentials.

**Everyone is signed out after a restart.** `AUTH_SECRET` is unset, so a random
secret is generated per process. Set it.

**The assistant will not quote a price.** Working as designed — every service for
this tenant is quote-only, and the assistant is forbidden from inventing a
number. Set `starting_price` on a service to change that.

**A booking is rejected as unavailable.** Check the booking rules at
`/dashboard/settings`: minimum notice, horizon, travel buffer, concurrent crews.

**A voice or calendar provider throws on startup.** You selected an adapter seat
that is not implemented in this build. Use `VOICE_PROVIDER=mock` /
`BOOKING_PROVIDER=internal`, or implement the adapter.
