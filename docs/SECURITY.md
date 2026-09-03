# Security

## Trust boundaries

Four sources of untrusted input, all handled the same way — parse before use:

| Boundary | Defences |
|---|---|
| Public forms (`/api/leads`, `/api/appointments`) | IP rate limit, honeypot, Zod, no auth needed |
| Website chat (`/api/chat`) | IP rate limit, Zod, length cap, business-scoped conversation lookup |
| Webhooks (`/api/webhooks/*`) | HMAC signature, Zod, idempotency ledger |
| AI tool calls | Per-tool Zod schema, business-scoped execution, audit row |

## Authentication

`lib/auth/` with two backends behind one interface.

**Supabase Auth** when `SUPABASE_URL` + anon key are configured (or
`AUTH_PROVIDER=supabase`). This app never handles a password: Supabase verifies
it, and the returned user is mapped to a row in `users`, which carries the
business and role. A Supabase user with no matching row cannot sign in.

**Development sign-in** otherwise. Credentials from `DEV_AUTH_EMAIL` /
`DEV_AUTH_PASSWORD`, defaulting to the seeded owner. Intended for local
development and the self-contained demo.

`AUTH_PROVIDER` overrides the auto-detection, so a deployment can use Supabase
for data while keeping the simple sign-in.

### Sessions

An HMAC-SHA256-signed cookie carrying `{ userId, businessId, email, role, exp }`
— `httpOnly`, `sameSite=lax`, `secure` in production, 8-hour expiry. Verified
with `timingSafeEqual`; an expired or tampered cookie is treated as no session.

`AUTH_SECRET` signs it. **If unset, a random per-process secret is generated**
and a warning is logged — sessions do not survive a restart. That is the correct
failure mode for a missing secret: a predictable default would let anyone forge
a session. Set it in production.

The cookie is a claim, not an authority. `getAuthContext()` re-loads the user
and business on every request and rejects the session if either has gone or if
they no longer match.

## Authorization and tenant isolation

Every business-owned table carries `business_id`. Every `DataStore` method takes
one. There is no method that reads a row without a tenant scope, so a leaked or
guessed id from one tenant cannot be used to read another's data — the query
simply returns nothing.

Server actions re-authenticate with `requireAuth()` and re-scope; they never
trust an id from the form. `canManage()` gates owner/admin-only operations.

`tests/integration/assistant.test.ts` asserts that a real record id is invisible
under a different business id.

## Row Level Security

The application server uses the Supabase **service-role key**, which bypasses
RLS. Authorization is enforced in the application, as above. RLS is defence in
depth: it makes sure anything that reaches Postgres with an end-user JWT — a
browser using the anon key, a future client-side query, a leaked publishable key
— can only ever see its own business's rows.

`supabase/migrations/0002_rls.sql`:

- RLS enabled on all 15 tables. Deny by default: no permissive policy for a role
  means no access.
- `public.current_business_id()` resolves the caller's business through
  `users.auth_user_id = auth.uid()`.
- Tables with `business_id` get a policy comparing it to that function.
- `addresses` and `messages` reach it through their parent with an `EXISTS`.
- The `anon` role has table privileges revoked. Public pages read business and
  service data through the server, never from the browser.

## Secrets

- Server-only values are never prefixed `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `AUTH_SECRET` and the webhook
  secrets are read exclusively in server modules.
- `lib/db/index.ts`, `lib/auth/*` and `lib/bootstrap.ts` import `server-only`,
  so pulling them into a client bundle is a build error rather than a leak.
- `.gitignore` covers `.env*`. `.env.example` contains placeholders only.

## Webhook verification

HMAC-SHA256 over the raw body, compared with `timingSafeEqual`, against
`x-signature` or `x-webhook-signature`. An invalid signature returns 401 before
the body is parsed.

**When the secret is unset, verification is skipped** — deliberate for local
development, where the mock provider is the only thing posting. Set
`SMS_WEBHOOK_SECRET` and `VOICE_WEBHOOK_SECRET` in production.

Every webhook is idempotent via `recordWebhookEvent()`, backed by a unique
constraint on `(provider, provider_event_id)`. Duplicates return 200 so the
provider stops retrying.

## Rate limiting

Fixed-window, in-process (`lib/http/rate-limit.ts`):

| Endpoint | Limit |
|---|---|
| `POST /api/leads` | 6 per 10 minutes per IP |
| `POST /api/appointments` | 8 per 10 minutes per IP |
| `POST /api/chat` | 30 per 5 minutes per IP |
| `GET /api/availability` | 60 per minute per IP |
| Sign-in | 10 per 10 minutes per IP |

**On multi-instance deployments this limits per instance.** Adequate for an MVP
and enough to make abuse expensive; swap the backing map for Redis when traffic
justifies it.

Webhooks are not IP rate limited — they are protected by signature verification
and idempotency, and rate limiting a legitimate provider's retries would drop
real customer messages.

## Input handling

`lib/validation/schemas.ts` is the single boundary module. Strings are stripped
of C0/C1 control characters, whitespace-collapsed, trimmed and length-capped.
Phones normalize to E.164, emails lowercase — both feed de-duplication.

Output is escaped by React. The one `dangerouslySetInnerHTML` is the JSON-LD
block in the marketing layout, serialized from our own database record with no
user input in it.

## Logging

Structured JSON with request id, business id, user id, provider, event type,
outcome and latency.

`lib/logging/logger.ts` redacts any key whose name contains `apikey`,
`api_key`, `authorization`, `password`, `secret`, `token`, `servicerolekey`,
`anonkey`, `signature` or `cookie`, recursively. `tests/unit/logger.test.ts`
asserts a live-looking key never reaches output.

Internal error text never reaches the client. `jsonServerError()` logs the real
error with a generated request id and returns an opaque message plus that id.

## AI-specific risk

Covered in [AI.md](AI.md). In short: the model cannot touch the database, tool
arguments are schema-parsed, tools are business-scoped and cannot take a
business id, every call is audited to `ai_actions`, and the blast radius of a
fully compromised turn is bounded by what the twelve tools allow.

## Known gaps

Honest list of what an MVP does not have:

1. **Rate limiting is per instance.** Needs a shared store to be effective
   behind a load balancer.
2. **No CSRF token on server actions.** Next's server actions and the
   `sameSite=lax` cookie mitigate this; a token would be better.
3. **No audit log for staff actions.** AI actions are audited; a human changing
   a lead status is not.
4. **No account lockout or MFA** on the dev sign-in. Supabase Auth provides both
   — another reason to use it in production.
5. **Twilio's real signature scheme is not implemented** — the generic HMAC is a
   placeholder for that vendor.
6. **No data retention policy.** Transcripts and recordings are customer data
   and should expire.
7. **No SMS opt-out handling**, which is legally required before sending to real
   numbers in the US.
