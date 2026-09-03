# Voice

## Provider abstraction

```ts
interface VoiceProvider {
  startOutboundCall(input): Promise<VoiceCallSummary>;
  getCall(providerCallId): Promise<VoiceCallSummary | null>;
  transferCall(providerCallId, toNumber): Promise<void>;
  verifyWebhook(rawBody, headers): boolean;
}
```

Vendor payloads are normalized into `VoiceCallSummary` before anything
downstream sees them, so the CRM, the missed-call automation and the assistant
never depend on which provider is configured.

| Implementation | Selected by | Status |
|---|---|---|
| `MockVoiceProvider` | default | In-process call log. The webhook path, missed-call automation and CRM timeline are all exercisable end to end. |
| `VapiVoiceProvider` | `VOICE_PROVIDER=vapi` | Declared seat — throws with setup instructions |
| `RetellVoiceProvider` | `VOICE_PROVIDER=retell` | Declared seat |
| `TwilioVoiceProvider` | `VOICE_PROVIDER=twilio` | Declared seat |

Real outbound telephony is explicitly out of scope for this build. The seats
fail loudly at call time rather than pretending a call was placed. Inbound
webhook verification still works on every seat, so a vendor can be pointed at
the webhook before its outbound API is implemented.

## Architecture

```
Phone number → Voice provider → AI agent → Application tools → Booking / CRM → Response
```

The agent is the same one behind web chat and SMS. What a vendor integration
adds is transport: audio in, audio out, and tool calls routed to this app's
endpoints.

## The call flow

```
Customer calls
  ↓ provider answers, AI agent greets
  ↓ identify intent
  ↓ ask service + location questions
  ↓ get_customer            existing customer?
  ↓ create_customer / create_lead
  ↓ check_availability      real openings only
  ↓ offer times
  ↓ customer confirms
  ↓ create_appointment
  ↓ confirmation SMS + owner notification
  ↓ transcript and summary saved to the call record
```

**If booking fails, the assistant does not pretend it succeeded.** It says the
request could not be completed and takes details for a callback. This is rule 13
in the system prompt and it matters more on the phone than anywhere else — a
caller told they are booked will not call back.

## Webhook

`POST /api/webhooks/voice`

```json
{
  "eventId": "unique-per-delivery",
  "event": "call.started | call.completed | call.missed | call.failed",
  "callId": "provider-call-id",
  "from": "+19735550188",
  "to": "+19737508757",
  "direction": "inbound",
  "durationSeconds": 212,
  "transcript": "...",
  "summary": "...",
  "outcome": "booked"
}
```

Pipeline: signature check → Zod → idempotency on `eventId` → `recordVoiceEvent()`
→ analytics → optional assistant turn.

Two levels of de-duplication, because they catch different things:

- `recordWebhookEvent(provider, eventId)` rejects an exact replay.
- `recordVoiceEvent` upserts on `(business_id, provider, provider_call_id)`, so
  the legitimate `call.started` → `call.completed` sequence updates one call row
  instead of creating two.

`call.missed` on an inbound call emits `call.missed`, which runs the recovery
automation in [SMS.md](SMS.md).

A completed call that carries a transcript is replayed through the assistant, so
the enquiry is captured as a lead instead of sitting in a transcript nobody
reads.

## Implementing a vendor

1. Implement the four `VoiceProvider` methods in `lib/voice/provider.ts`.
2. Implement `verifyWebhook` against that vendor's signature scheme.
3. Map the vendor's webhook body to the normalized shape — extend
   `voiceWebhookSchema` if the vendor cannot be configured to post this shape.
4. Point the vendor's assistant at this app's tool endpoints, or bridge its tool
   calls to `executeTool`.

Keep the normalization at the edge. Nothing past the route handler should know
which vendor is in use.

## Requirements for a real deployment

- Natural voice with interruption / barge-in and low latency.
- Tool calling wired to the twelve tools in [AI.md](AI.md).
- Transfer to a human on escalation, using
  `settings.ai.escalationPhone`.
- Recording and transcription, plus the consent and retention rules that come
  with them. New Jersey is one-party consent, but a recording announcement is
  standard practice and other states differ.
- Call recordings and transcripts are customer data: apply a retention policy
  rather than keeping them forever.
