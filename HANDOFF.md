# Handoff — what is done, what is left

The MVP is complete and verified. This file is the short status; the full
documentation is in [README.md](README.md) and [docs/](docs/).

## Verified state

```
npm run lint       clean
npm run typecheck  clean
npm test           96 unit + integration tests passing
npm run test:e2e   34 browser tests passing (desktop + mobile)
npm run build      28 routes
```

Committed on `main`. Working tree clean.

## Definition of done — met

**Website.** A customer can open the site, understand the services, click *Get a
Free Estimate*, submit their details and receive a confirmation. Asserted end to
end in `tests/e2e/lead-to-crm.spec.ts`.

**CRM.** The owner can sign in, see the lead, open it, see the customer, contact
details and address, change the status, and see conversations and appointments.
Same spec.

**Booking.** A customer can request an appointment, see real availability, pick
a time, get it booked, and receive a confirmation — with double-booking
prevented. `tests/e2e/booking-and-chat.spec.ts` plus
`tests/integration/booking.test.ts`.

**AI.** One assistant across web chat, SMS and phone, with twelve
schema-validated tools, a full audit trail, and pricing safety enforced in three
independent places.

## What is left

### 1. Push to GitHub — needs your go-ahead
The remote `https://github.com/Alwinphilip0105/innovation-power-washing-mvp.git`
is still empty. Nothing has been pushed.

```bash
git remote add origin https://github.com/Alwinphilip0105/innovation-power-washing-mvp.git
git push -u origin main
```

### 2. Supabase persistence — blocked on one credential
The default in-memory store is per process. On Vercel that means **a lead
submitted on the website may not appear in the dashboard**. Everything needed to
fix it is in the repo — `supabase/migrations/0001_init.sql`, `0002_rls.sql` and
`npm run db:seed` — but it needs the **Supabase service-role key**, which was
never provided. Steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Decide before deploying: memory mode is fine for a demo, not for real enquiries.

### 3. Deploy
`vercel --prod`, set the environment variables (`AUTH_SECRET` is required),
point `invpowerwash.alwinphilip.online` at it, then check `/api/health`.
Full walkthrough in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Deliberately not built

- **Vendor adapters** for Google Calendar, Cal.com, Calendly, Vapi, Retell and
  Twilio voice are declared seats that throw a descriptive error. There were no
  accounts to test against, and an integration that silently pretends to work is
  worse than one that refuses.
- **`AnthropicAIProvider`** is written and type-checked but has never run against
  the live API — no key was available. Exercise it once one exists.
- Payment processing, review generation, marketing automation and a
  customer-facing portal are out of MVP scope.
- Known security gaps are listed honestly in
  [docs/SECURITY.md](docs/SECURITY.md#known-gaps) — the notable ones are
  per-instance rate limiting and no SMS opt-out handling, which is legally
  required before texting real US numbers.
