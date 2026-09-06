import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/demo/voice/route";
import { DEMO_CALLER_NUMBER, DEMO_VOICE_PROVIDER } from "@/services/voice-demo";
import { resetWorld, TEST_NOW, type World } from "@/tests/helpers/world";

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/demo/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify(body),
    }),
  );
}

async function payload(response: Response) {
  return (await response.json()) as { ok: boolean; error?: string; data?: Record<string, unknown> };
}

/** One spoken turn. Returns what the caller would hear back. */
async function say(callId: string, conversationId: string | null, message: string) {
  const response = await post({ action: "turn", callId, conversationId, message });
  const body = await payload(response);
  expect(body.ok, body.error).toBe(true);
  return body.data as { conversationId: string; reply: string; escalated: boolean; tools: string[] };
}

describe("browser voice demo", () => {
  let world: World;
  let callId: string;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
    callId = crypto.randomUUID();
  });

  it("opens a call record and a phone conversation on the first thing the caller says", async () => {
    const turn = await say(callId, null, "Hi, I'd like to get my house washed.");

    expect(turn.reply.length).toBeGreaterThan(0);

    const call = await world.store.getCallByProviderId(world.business.id, DEMO_VOICE_PROVIDER, callId);
    expect(call).not.toBeNull();
    expect(call!.status).toBe("in_progress");
    expect(call!.direction).toBe("inbound");
    expect(call!.phone_number).toBe(DEMO_CALLER_NUMBER);

    const conversation = await world.store.getConversationById(world.business.id, turn.conversationId);
    expect(conversation?.channel).toBe("phone");

    // The greeting the browser spoke is on the record, so the transcript starts
    // where the call started and the assistant does not greet twice.
    const messages = await world.store.listMessages(turn.conversationId);
    expect(messages[0].direction).toBe("outbound");
    expect(messages[0].body).toMatch(/Thanks for calling/);
  });

  it("books a real appointment and closes the call as booked", async () => {
    const opening = await say(callId, null, "I'd like to book a house wash.");
    expect(opening.tools).toContain("check_availability");

    const booking = await say(
      callId,
      opening.conversationId,
      "Dana Alvarez, 973-555-0190. 9 Lakeside Avenue, Pompton Lakes 07442. The first one works.",
    );
    expect(booking.tools).toEqual(
      expect.arrayContaining(["create_customer", "create_lead", "create_appointment"]),
    );

    const customer = await world.store.findCustomerByPhone(world.business.id, "+19735550190");
    expect(customer).not.toBeNull();

    const appointments = await world.store.listAppointments(world.business.id, {
      customerId: customer!.id,
    });
    expect(appointments).toHaveLength(1);

    // The call is linked to whoever the assistant turned out to be talking to,
    // which is only knowable partway through - the caller id is a placeholder.
    const midCall = await world.store.getCallByProviderId(
      world.business.id,
      DEMO_VOICE_PROVIDER,
      callId,
    );
    expect(midCall?.customer_id).toBe(customer!.id);

    const ended = await payload(
      await post({
        action: "end",
        callId,
        conversationId: booking.conversationId,
        durationSeconds: 96,
      }),
    );
    expect(ended.ok, ended.error).toBe(true);
    expect(ended.data?.outcome).toBe("booked");

    const call = await world.store.getCallByProviderId(world.business.id, DEMO_VOICE_PROVIDER, callId);
    expect(call!.status).toBe("completed");
    expect(call!.duration).toBe(96);
    expect(call!.transcript).toMatch(/Caller: I'd like to book a house wash\./);
    expect(call!.transcript).toMatch(/Agent: /);
    expect(call!.summary).toBeTruthy();

    // Closing the call must not drop the customer link: `recordVoiceEvent`
    // re-resolves the customer from the placeholder caller id.
    expect(call!.customer_id).toBe(customer!.id);
  });

  it("closes an enquiry that never became a lead as an enquiry", async () => {
    const turn = await say(callId, null, "Do you clean paver driveways?");

    const ended = await payload(
      await post({ action: "end", callId, conversationId: turn.conversationId, durationSeconds: 20 }),
    );
    expect(ended.data?.outcome).toBe("enquiry");
  });

  it("writes a readable summary for a caller who opened with a greeting", async () => {
    // The summary goes on the call record and in front of whoever is being
    // shown the demo, so "Hi asked about Gutter Cleaning No phone captured.."
    // is not good enough.
    const turn = await say(callId, null, "Hi, do you clean gutters?");

    const ended = await payload(
      await post({ action: "end", callId, conversationId: turn.conversationId, durationSeconds: 18 }),
    );

    const summary = ended.data?.summary as string;
    expect(summary).toBeTruthy();
    expect(summary).not.toMatch(/\.\./);
    // "Hi" is a greeting, not the caller's name.
    expect(summary).toMatch(/^Caller /);
    expect(summary).toMatch(/No phone captured\.$/);
  });

  it("records a call the caller abandons before saying anything useful", async () => {
    const turn = await say(callId, null, "Hello?");

    const ended = await payload(
      await post({ action: "end", callId, conversationId: turn.conversationId, durationSeconds: 4 }),
    );
    expect(ended.ok).toBe(true);

    const call = await world.store.getCallByProviderId(world.business.id, DEMO_VOICE_PROVIDER, callId);
    expect(call!.status).toBe("completed");
    expect(call!.duration).toBe(4);
  });

  it("rejects a malformed turn without touching the CRM", async () => {
    const response = await post({ action: "turn", callId, message: "" });
    expect(response.status).toBe(400);

    const call = await world.store.getCallByProviderId(world.business.id, DEMO_VOICE_PROVIDER, callId);
    expect(call).toBeNull();
  });

  it("ignores a conversation id that belongs to nothing", async () => {
    const turn = await say(callId, crypto.randomUUID(), "Hi there.");

    // A bogus id must start a fresh call rather than fail or leak another row.
    expect(turn.conversationId).toBeTruthy();
    const conversation = await world.store.getConversationById(world.business.id, turn.conversationId);
    expect(conversation?.channel).toBe("phone");
  });
});
