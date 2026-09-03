# Handoff brief — Innovation Power Washing MVP

Paste everything below the line into Cursor as the opening prompt for the next
session. It describes the codebase, the conventions to keep, and the work that
is still outstanding.

---

## Context

You are continuing work on an **AI-powered customer acquisition and operations
platform for local service businesses**. It is a working Next.js MVP, not a
mockup. The first tenant is **Innovation Power Washing** (Pompton Lakes / Wayne,
NJ), but the architecture is multi-tenant: every business-owned row carries
`business_id` and the tenant is resolved at runtime, never hardcoded.

Repo: `C:\Users\alwin\innovation-power-washing-mvp`
Deploy target: Vercel, at `invpowerwash.alwinphilip.online`.

### Stack

Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind v4 ·
Zod v4 · Vitest · Supabase (Postgres) as the optional production data store ·
`@anthropic-ai/sdk` as the optional real LLM provider.

## Current state — all green, verified

```
npx tsc --noEmit   # clean
npx eslint .       # clean
npx vitest run     # 10 files, 96 tests passing
npm run build      # succeeds, 28 routes
```

### What is already built

**Provider abstractions (this is the core design idea).** Nothing in the app
imports a vendor SDK directly. Each capability is an interface with a mock
implementation selected by environment variable, so `npm run dev` runs the
entire product — website, chat, booking, CRM, webhooks — with **zero
credentials and no paid services**.

| Seam | Interface | Default | Real option |
|---|---|---|---|
| Data | `lib/db/store.ts` `DataStore` | `MemoryStore` (seeded) | `SupabaseStore` |
| AI | `lib/ai/types.ts` `AIProvider` | `MockAIProvider` | `AnthropicAIProvider` |
| Booking | `lib/booking/provider.ts` | `InternalBookingProvider` | Google / Cal.com / Calendly adapter seats |
| SMS | `lib/sms/provider.ts` | `MockSmsProvider` | `TwilioSmsProvider` |
| Voice | `lib/voice/provider.ts` | `MockVoiceProvider` | Vapi / Retell / Twilio seats |
| Email | `lib/notifications/provider.ts` | `MockEmailProvider` (in-app outbox) | `ResendEmailProvider` |

**Marketing site** — `app/(marketing)/`: home, services, about, gallery,
service-area, contact, book. Custom SVG illustration system in
`components/graphics/scenes.tsx` renders before/after scenes (siding, concrete,
deck, roof, storefront) so there are no empty photo frames. Sticky header,
mobile nav, JSON-LD `HomeAndConstructionBusiness`, sitemap, robots.

**Lead capture** — validated form → `POST /api/leads` → customer + address +
lead + owner notification. Honeypot field, IP rate limiting, phone/email
de-duplication.

**Booking** — `components/booking/booking-flow.tsx` reads real openings from
`GET /api/availability` and books via `POST /api/appointments`. All rules are
enforced server-side in `lib/booking/availability.ts`: business hours,
minimum notice, booking horizon, travel buffer, max concurrent crews.
Timezone-correct (verified across a DST boundary in tests).

**AI assistant** — one engine (`lib/ai/engine.ts`) shared by web chat, SMS and
the voice webhook; only the channel guidance in the prompt differs. Twelve
tools in `lib/ai/tools.ts` (`get_services`, `check_availability`,
`create_customer`, `create_lead`, `create_appointment`, `notify_owner`, …).
The contract is: **AI → schema validation → business-scoped context → service
layer → DB**. The model never touches the database. Every tool call is written
to `ai_actions` as an audit row.

**Automations** — `lib/events/` in-process event bus plus handlers for
`lead.created`, `appointment.created`, `appointment.cancelled`, `call.missed`
(→ automatic follow-up SMS + AI conversation), `estimate.requested`,
`escalation.required`.

**Dashboard** — `app/dashboard/`: overview with live metrics, leads list with
search/filter, lead detail with full timeline, appointments, conversations,
calls, estimates, services, settings (shows which providers are wired and the
assistant's audit trail). Auth via `lib/auth/` — Supabase Auth when configured,
signed-cookie dev sign-in otherwise.

**Database** — `supabase/migrations/0001_init.sql` (15 tables, FKs, indexes,
constraints, `updated_at` triggers) and `0002_rls.sql` (RLS on every table,
tenant isolation through `public.current_business_id()`). `scripts/seed.ts`
loads the same demo dataset the memory store uses.

## Conventions to follow

1. **Never bypass a provider interface.** No vendor SDK imports outside
   `lib/<capability>/`.
2. **Never let unvalidated input reach the store.** Everything crossing a
   boundary parses through `lib/validation/schemas.ts` first.
3. **Never invent a price.** Services are quote-only for this tenant. The
   assistant may state only a configured `starting_price`; with none, it must
   raise an estimate request. `tests/unit/pricing-safety.test.ts` guards this.
4. **Always scope by `business_id`.** Every store method takes it. Server
   actions re-authenticate with `requireAuth()` and re-scope.
5. **Never expose internal errors.** Use `lib/http/responses.ts`; real detail
   goes to the structured logger, which redacts secret-looking keys.
6. **Webhooks must be idempotent** via `store.recordWebhookEvent()`.
7. **This is Next 16** — `params`/`searchParams`/`cookies()` are async;
   `middleware` is now `proxy`; `next lint` is gone. Read
   `node_modules/next/dist/docs/` before using an unfamiliar API.
8. Run `npm run check` (lint + typecheck + tests) before declaring anything done.

## Outstanding work, in priority order

### 1. Documentation and configuration — required, not yet started
- `.env.example` with every variable in `lib/env.ts` (`DATA_STORE`,
  `SUPABASE_*`, `AI_PROVIDER`, `LLM_API_KEY`, `SMS_*`, `VOICE_*`, `EMAIL_*`,
  `BOOKING_PROVIDER`, `AUTH_PROVIDER`, `AUTH_SECRET`, `APP_URL`). `.gitignore`
  already ignores `.env*`.
- Replace the default `README.md`: overview, prerequisites, install, env vars,
  database setup, local dev, test commands, deployment, provider configuration,
  troubleshooting.
- `docs/ARCHITECTURE.md`, `docs/AI.md`, `docs/VOICE.md`, `docs/SMS.md`,
  `docs/BOOKING.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`.

### 2. Persistence for the deployed demo — important
The default `MemoryStore` is per-process. On Vercel each serverless invocation
may get a fresh instance, so **a lead submitted on the website may not appear in
the dashboard on the deployed site**. Two options:

- **Recommended:** apply `supabase/migrations/*.sql` to the Supabase project,
  set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, run `npm run db:seed`, and
  create a Supabase Auth user mapped to `users.auth_user_id`. Set
  `AUTH_PROVIDER=dev` if you want to keep the simple sign-in while using
  Supabase for data.
- Or document the limitation prominently and keep the demo in memory mode.

Note the Supabase project URL and publishable key are known, but the
**service-role key has not been provided** — it is required for the data store.

### 3. End-to-end tests — specified but not written
Add Playwright (`@playwright/test`, `playwright.config.ts`, `tests/e2e/`) and
cover: website → submit lead → confirmation → sign in → lead visible in the
dashboard; and pick a slot → book → confirmation. `npx playwright install
chromium` is needed. Unit and integration coverage is already in place.

### 4. Deployment
`vercel.json` if any header/redirect config is needed, plus the Vercel env-var
setup and the custom domain.

### 5. Git
**The project is not a git repository yet.** `git init`, first commit, then
push to `https://github.com/Alwinphilip0105/innovation-power-washing-mvp.git`
(currently empty).

### 6. Nice to have
- Runtime smoke test: `npm run dev`, click through every page and the chat
  widget. This has not been done yet — only the production build has been
  verified.
- `AnthropicAIProvider` (`lib/ai/anthropic-provider.ts`) is written against
  Claude Opus 5 with adaptive thinking and server-side refusal fallbacks, but
  has never been executed against the live API. Exercise it once a key exists.
- The vendor adapter seats (Google Calendar, Cal.com, Calendly, Vapi, Retell,
  Twilio voice) intentionally throw a descriptive error rather than shipping
  untested integration code. Implement whichever the customer actually needs.
