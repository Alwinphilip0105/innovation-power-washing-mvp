# SMS

## Provider abstraction

```ts
interface SmsProvider {
  send(message: OutboundSms): Promise<SmsSendResult>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
}
```

| Implementation | Selected by | Behaviour |
|---|---|---|
| `MockSmsProvider` | default | Logs the message, returns a mock id. The message is still recorded on the conversation, so the thread looks real in the dashboard. |
| `TwilioSmsProvider` | `SMS_PROVIDER=twilio` | Posts to the Twilio Messages resource. `SMS_PROVIDER_API_KEY` is `ACCOUNT_SID:AUTH_TOKEN`. |

The Twilio path is written against the documented API shape but is not exercised
in this build — there is no account. Every failure surfaces and is logged rather
than silently dropping a text.

## Inbound

`POST /api/webhooks/sms`

```json
{
  "eventId": "unique-per-delivery",
  "from": "+19735550188",
  "to": "+19737508757",
  "body": "how much to clean my driveway?",
  "messageId": "provider-message-id"
}
```

Pipeline:

```
raw body → verifyWebhook()            HMAC-SHA256, constant-time
         → JSON.parse + Zod
         → recordWebhookEvent()       idempotency on (provider, eventId)
         → findOrCreateCustomer()     dedupe on normalized phone
         → getOrCreateConversation()  channel "sms"
         → runAssistantTurn()         the same assistant as web chat
         → provider.send(reply)
```

**Idempotency matters here.** Providers retry. Without the ledger, a retried
delivery produces a second AI reply to the same text. A duplicate `eventId`
returns `200 {"duplicate": true}` and does nothing else — providers must see a
success or they keep retrying.

Empty bodies (delivery receipts and similar) are recorded on the thread but not
answered.

A reply that fails to send is logged and the inbound message stays recorded. It
is not blindly retried — a retry loop against a failing provider is how you send
someone eleven texts.

## Outbound

Three sources, all of which record the message on a conversation so the
dashboard shows the full thread:

| Trigger | Message |
|---|---|
| `appointment.created` | "You're on the schedule with … for …" |
| `call.missed` | "Sorry we missed your call — this is … How can we help?" |
| Assistant reply | Whatever the assistant produced for that turn |

## Missed-call recovery

The highest-value automation in the product: an unanswered call becomes a
qualified lead without anyone picking up.

```
call.missed
  → ensureLeadForCall()     customer + lead ("contacted"), call row linked
  → SMS: "Sorry we missed your call…"
  → recorded on a new SMS conversation
  → owner notification

customer replies
  → /api/webhooks/sms
  → same conversation, same assistant
  → prices, checks availability, books
```

Covered end to end by `tests/integration/webhooks.test.ts`.

## Signature verification

`verifyHmacSignature()` in `lib/sms/providers.ts` compares an HMAC-SHA256 of the
raw body against `x-signature` (or `x-webhook-signature`) using
`timingSafeEqual`.

**When `SMS_WEBHOOK_SECRET` is unset, verification is skipped.** That is
deliberate for local development, where the mock provider is the only thing
posting. Set the secret in production — an unverified webhook endpoint lets
anyone inject messages into a customer conversation.

Twilio's production signature scheme differs from this generic HMAC; implement
`TwilioSmsProvider.verifyWebhook` against `X-Twilio-Signature` before going
live with Twilio.

## Testing locally

The dev server accepts webhook posts with no secret configured:

```bash
curl -X POST http://localhost:3000/api/webhooks/sms \
  -H "Content-Type: application/json" \
  -d '{"eventId":"local-1","from":"9735550188","to":"9737508757","body":"how much for a house wash?"}'
```

Then open `/dashboard/conversations` to see the thread and the assistant's
reply. Repost the same `eventId` to watch idempotency reject the duplicate.

## Compliance

Not implemented, and required before sending to real numbers in the US:

- Opt-out handling (STOP / UNSTOP / HELP) — legally required.
- Quiet hours.
- A2P 10DLC registration with the carrier.
- Consent capture and an audit trail of it.

The web form's privacy line covers using details to quote and schedule; it is
not an SMS marketing consent.
