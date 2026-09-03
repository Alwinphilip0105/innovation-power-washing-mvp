# Deployment

Target: **Vercel**, at `invpowerwash.alwinphilip.online`.

## Decide the data store first

This is the one decision that changes what the deployed site can do.

### Option A — memory mode (fastest, demo only)

No database. The site builds and serves the marketing pages, chat, booking and
dashboard against the seeded demo dataset.

**The limitation, plainly:** the in-memory store is per-process. On serverless
each invocation may get its own copy, so **a lead submitted on the website may
not appear in the dashboard**, and anything written is lost when the instance
recycles. Fine for showing the product; not fine for taking real customer
enquiries.

### Option B — Supabase (recommended)

Durable, consistent across invocations, and the dashboard reflects real
activity. Requires the service-role key.

1. Apply the migrations in the Supabase SQL Editor, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
2. Locally, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
   and load the demo data:
   ```bash
   npm run db:seed
   ```
3. For Supabase Auth, create a user in the Supabase dashboard and set
   `users.auth_user_id` on the matching row:
   ```sql
   update public.users
      set auth_user_id = '<supabase-auth-user-uuid>'
    where email = 'owner@innovationpowerwashing.com';
   ```
   To keep the simple dev sign-in while using Postgres for data, set
   `AUTH_PROVIDER=dev` instead.

## Deploy

```bash
npm i -g vercel
vercel link
vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard and let it build on
push. `vercel.json` sets the framework and security headers; no build
configuration is needed beyond that.

## Environment variables

Set these in **Project → Settings → Environment Variables**. Everything is
optional except where noted.

### Always

| Variable | Value |
|---|---|
| `APP_URL` | `https://invpowerwash.alwinphilip.online` |
| `NEXT_PUBLIC_APP_URL` | same |
| `AUTH_SECRET` | **Required in production.** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `LOG_LEVEL` | `info` |

Without `AUTH_SECRET`, a random secret is generated per process and every
instance recycle signs everyone out.

### Option B additions

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Never prefix with `NEXT_PUBLIC_`. |
| `SUPABASE_ANON_KEY` | Publishable key, only if using Supabase Auth |
| `AUTH_PROVIDER` | `dev` to keep the seeded sign-in with Supabase data |

### Live providers, when you want them

| Variable | Notes |
|---|---|
| `AI_PROVIDER=anthropic`, `LLM_API_KEY` | Real Claude instead of the mock |
| `SMS_PROVIDER=twilio`, `SMS_PROVIDER_API_KEY`, `SMS_PHONE_NUMBER` | `ACCOUNT_SID:AUTH_TOKEN` |
| `SMS_WEBHOOK_SECRET`, `VOICE_WEBHOOK_SECRET` | **Set these.** Unset means signature verification is skipped. |
| `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | Real owner notifications |

## Domain

1. Vercel → Project → Settings → Domains → add
   `invpowerwash.alwinphilip.online`.
2. Add the CNAME Vercel shows at your DNS provider.
3. Wait for the certificate.
4. Update `APP_URL` / `NEXT_PUBLIC_APP_URL` to the final URL and redeploy —
   they drive canonical metadata, the sitemap, and dashboard links inside owner
   emails.

## Webhooks

Point providers at:

```
https://invpowerwash.alwinphilip.online/api/webhooks/sms
https://invpowerwash.alwinphilip.online/api/webhooks/voice
```

Both expect the normalized JSON body in [SMS.md](SMS.md) and [VOICE.md](VOICE.md),
signed with HMAC-SHA256 over the raw body in `x-signature`.

## Verify the deploy

```bash
curl https://invpowerwash.alwinphilip.online/api/health
```

Returns the environment, which data store is active and whether it is reachable,
and which provider is wired for each capability. No secrets. `"dataStore":
{"kind": "memory"}` means Option A is live — expect the persistence caveat.

Then, by hand:

1. Load `/` — hero, services, gallery slider, FAQ.
2. Submit the estimate form, confirm the success state.
3. Sign in at `/login`.
4. Check the lead appears at `/dashboard/leads` — **if it does not, you are on
   memory mode across separate instances.**
5. Open the chat widget, ask about pricing, walk through a booking.
6. Check `/dashboard/settings` for the provider list and the assistant audit
   trail.

## Pre-deploy gate

```bash
npm run check    # lint + typecheck + tests
npm run build
```

## Troubleshooting

**Build fails on fonts.** `next/font/google` downloads at build time. The build
host needs outbound network access.

**Dashboard is empty after deploying.** Memory mode plus a fresh instance.
Configure Supabase.

**Signed out constantly.** `AUTH_SECRET` is unset.

**`SupabaseStore requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`.**
`DATA_STORE=supabase` without the credentials. Provide them or unset it.

**`/api/health` reports the store unreachable.** Migrations have not been
applied, or the service-role key is wrong.

**Webhooks return 401.** The secret is set on the server but the signature does
not match. Confirm the HMAC is over the exact raw body.

**A voice or calendar provider throws.** You selected an adapter seat that is
not implemented. Use `VOICE_PROVIDER=mock` / `BOOKING_PROVIDER=internal`.
