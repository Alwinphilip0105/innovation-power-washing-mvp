import { beforeEach, describe, expect, it } from "vitest";

import { runAssistantTurn } from "@/lib/ai/engine";
import { getEmailOutbox } from "@/lib/notifications/providers";
import { recordVoiceEvent } from "@/services/calls";
import { getOrCreateConversation } from "@/services/conversations";
import { findOrCreateCustomer } from "@/services/customers";
import { resetWorld, TEST_NOW, type World } from "@/tests/helpers/world";

describe("missed call automation", () => {
  let world: World;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
  });

  it("creates a lead, texts the caller back and alerts the owner", async () => {
    const call = await recordVoiceEvent(world.business, {
      event: "call.missed",
      provider: "mock",
      callId: "call-missed-1",
      from: "+19085550199",
      to: world.business.phone,
      direction: "inbound",
      startedAt: TEST_NOW.toISOString(),
    });

    expect(call.status).toBe("missed");

    // Lead created for the unknown caller.
    const customer = await world.store.findCustomerByPhone(world.business.id, "+19085550199");
    expect(customer).not.toBeNull();

    const leads = await world.store.listLeads(world.business.id, { customerId: customer!.id });
    expect(leads).toHaveLength(1);
    expect(leads[0].status).toBe("contacted");
    expect(leads[0].source).toBe("phone");

    // Follow-up text, recorded on an SMS thread.
    const conversations = await world.store.listConversations(world.business.id, {
      customerId: customer!.id,
      channel: "sms",
    });
    expect(conversations).toHaveLength(1);

    const messages = await world.store.listMessages(conversations[0].id);
    expect(messages[0].body).toMatch(/Sorry we missed your call/);
    expect(messages[0].status).toBe("delivered");
    expect(messages[0].provider_message_id).toMatch(/^mock-sms-/);

    // Owner notified.
    expect(getEmailOutbox().some((entry) => entry.subject.includes("Missed call"))).toBe(true);

    // The call row now points at the customer and the lead.
    const refreshed = await world.store.getCallById(world.business.id, call.id);
    expect(refreshed?.customer_id).toBe(customer!.id);
    expect(refreshed?.lead_id).toBe(leads[0].id);
  });

  it("does not fire the automation for a completed call", async () => {
    await recordVoiceEvent(world.business, {
      event: "call.completed",
      provider: "mock",
      callId: "call-ok-1",
      from: "+19085550188",
      to: world.business.phone,
      direction: "inbound",
      durationSeconds: 90,
    });

    expect(getEmailOutbox().some((entry) => entry.subject.includes("Missed call"))).toBe(false);
  });

  it("upserts on the provider call id rather than creating a second row", async () => {
    const started = await recordVoiceEvent(world.business, {
      event: "call.started",
      provider: "mock",
      callId: "call-seq-1",
      from: "+19085550177",
      to: world.business.phone,
      direction: "inbound",
      startedAt: TEST_NOW.toISOString(),
    });

    const completed = await recordVoiceEvent(world.business, {
      event: "call.completed",
      provider: "mock",
      callId: "call-seq-1",
      from: "+19085550177",
      to: world.business.phone,
      direction: "inbound",
      durationSeconds: 212,
      summary: "Asked about deck cleaning.",
    });

    expect(completed.id).toBe(started.id);
    expect(completed.status).toBe("completed");
    expect(completed.duration).toBe(212);
    // The earlier started_at is preserved, not overwritten.
    expect(completed.started_at).toBe(started.started_at);
  });
});

describe("webhook idempotency", () => {
  let world: World;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
  });

  it("accepts an event id once and rejects the replay", async () => {
    expect(await world.store.recordWebhookEvent("mock", "evt-1", world.business.id)).toBe(true);
    expect(await world.store.recordWebhookEvent("mock", "evt-1", world.business.id)).toBe(false);
    expect(await world.store.recordWebhookEvent("mock", "evt-2", world.business.id)).toBe(true);
  });

  it("keeps ids from different providers separate", async () => {
    expect(await world.store.recordWebhookEvent("mock", "shared-id")).toBe(true);
    expect(await world.store.recordWebhookEvent("twilio", "shared-id")).toBe(true);
  });
});

describe("inbound SMS -> AI -> reply", () => {
  let world: World;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
  });

  it("answers a texted pricing question with the configured price", async () => {
    const { customer } = await findOrCreateCustomer(world.business.id, {
      firstName: "Texter",
      phone: "+19085550166",
    });

    const conversation = await getOrCreateConversation(world.business, {
      customerId: customer.id,
      channel: "sms",
      subject: "SMS conversation",
    });

    const result = await runAssistantTurn({
      business: world.business,
      conversation,
      customer,
      channel: "sms",
      body: "how much to clean my driveway?",
      providerMessageId: "sms-in-1",
      now: TEST_NOW,
    });

    expect(result.reply).not.toMatch(/\$\d/);
    expect(result.reply.toLowerCase()).toMatch(/estimate|take a look|quote/);

    const messages = await world.store.listMessages(conversation.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].provider_message_id).toBe("sms-in-1");
  });
});
