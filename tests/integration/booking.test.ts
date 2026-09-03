import { beforeEach, describe, expect, it } from "vitest";

import { getBookingProvider } from "@/lib/booking";
import { BookingError } from "@/lib/booking/availability";
import { getEmailOutbox } from "@/lib/notifications/providers";
import { parseZonedDateTime } from "@/lib/utils/datetime";
import { bookAppointment, cancelAppointment, setAppointmentStatus } from "@/services/appointments";
import { captureLead } from "@/services/leads";
import { resetWorld, TEST_NOW, type World } from "@/tests/helpers/world";

const TZ = "America/New_York";
const TUESDAY = "2026-06-09";

async function newCustomer(world: World, phone = "+19085550190") {
  const result = await captureLead({
    business: world.business,
    source: "website",
    identity: { firstName: "Dana", lastName: "Alvarez", phone },
    serviceSlug: "house-washing",
  });
  return result;
}

describe("booking -> CRM", () => {
  let world: World;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
  });

  it("books a free slot, moves the lead to booked and notifies the owner", async () => {
    const { customer, lead } = await newCustomer(world);
    const service = world.service("house-washing");
    const start = parseZonedDateTime(TUESDAY, "08:00", TZ);

    const appointment = await bookAppointment({
      business: world.business,
      service,
      customer,
      leadId: lead.id,
      startTime: start.toISOString(),
      source: "website",
      now: TEST_NOW,
    });

    expect(appointment.status).toBe("requested");
    expect(appointment.start_time).toBe(start.toISOString());
    // End time comes from the service record, not from the caller.
    expect(new Date(appointment.end_time).getTime() - start.getTime()).toBe(
      service.duration_minutes * 60_000,
    );

    const refreshedLead = await world.store.getLeadById(world.business.id, lead.id);
    expect(refreshedLead?.status).toBe("booked");

    const outbox = getEmailOutbox();
    expect(outbox.some((entry) => entry.subject.includes("Appointment requested"))).toBe(true);
  });

  it("texts the customer a confirmation and records it on the SMS thread", async () => {
    const { customer, lead } = await newCustomer(world);

    await bookAppointment({
      business: world.business,
      service: world.service("house-washing"),
      customer,
      leadId: lead.id,
      startTime: parseZonedDateTime(TUESDAY, "08:00", TZ).toISOString(),
      source: "website",
      now: TEST_NOW,
    });

    const conversations = await world.store.listConversations(world.business.id, {
      customerId: customer.id,
      channel: "sms",
    });
    expect(conversations).toHaveLength(1);

    const messages = await world.store.listMessages(conversations[0].id);
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toMatch(/You're on the schedule/);
    expect(messages[0].status).toBe("sent");
  });

  it("refuses a second booking in the same window once the crews are full", async () => {
    const service = world.service("house-washing");
    const start = parseZonedDateTime(TUESDAY, "08:00", TZ).toISOString();

    // maxConcurrentAppointments is 2, so the first two succeed.
    for (const phone of ["+19085550191", "+19085550192"]) {
      const { customer, lead } = await newCustomer(world, phone);
      await bookAppointment({
        business: world.business,
        service,
        customer,
        leadId: lead.id,
        startTime: start,
        source: "website",
        now: TEST_NOW,
      });
    }

    const { customer, lead } = await newCustomer(world, "+19085550193");
    const attempt = bookAppointment({
      business: world.business,
      service,
      customer,
      leadId: lead.id,
      startTime: start,
      source: "website",
      now: TEST_NOW,
    });

    await expect(attempt).rejects.toBeInstanceOf(BookingError);
    await expect(attempt).rejects.toMatchObject({ code: "slot_unavailable" });
  });

  it("refuses a slot outside business hours", async () => {
    const { customer, lead } = await newCustomer(world);

    const attempt = bookAppointment({
      business: world.business,
      service: world.service("house-washing"),
      customer,
      leadId: lead.id,
      startTime: parseZonedDateTime(TUESDAY, "19:00", TZ).toISOString(),
      source: "website",
      now: TEST_NOW,
    });

    await expect(attempt).rejects.toMatchObject({ code: "outside_business_hours" });
  });

  it("refuses a slot inside the notice window", async () => {
    const { customer, lead } = await newCustomer(world);

    const attempt = bookAppointment({
      business: world.business,
      service: world.service("house-washing"),
      customer,
      leadId: lead.id,
      startTime: parseZonedDateTime("2026-06-08", "09:00", TZ).toISOString(),
      source: "website",
      now: TEST_NOW,
    });

    await expect(attempt).rejects.toMatchObject({ code: "too_soon" });
  });

  it("stops offering a slot once it has been taken", async () => {
    const service = world.service("concrete-cleaning");
    const provider = getBookingProvider();

    const before = await provider.getAvailability({
      business: world.business,
      service,
      fromDate: TUESDAY,
      days: 1,
      now: TEST_NOW,
    });
    const target = before[0].slots.find((slot) => slot.time === "08:00");
    expect(target).toBeDefined();

    // Fill both crews at 08:00.
    for (const phone of ["+19085550194", "+19085550195"]) {
      const { customer, lead } = await newCustomer(world, phone);
      await bookAppointment({
        business: world.business,
        service,
        customer,
        leadId: lead.id,
        startTime: target!.start,
        source: "website",
        now: TEST_NOW,
      });
    }

    const after = await provider.getAvailability({
      business: world.business,
      service,
      fromDate: TUESDAY,
      days: 1,
      now: TEST_NOW,
    });
    expect(after[0].slots.some((slot) => slot.start === target!.start)).toBe(false);
  });

  it("frees the slot again when the appointment is cancelled", async () => {
    const service = world.service("house-washing");
    const start = parseZonedDateTime(TUESDAY, "08:00", TZ).toISOString();

    const booked = [];
    for (const phone of ["+19085550196", "+19085550197"]) {
      const { customer, lead } = await newCustomer(world, phone);
      booked.push(
        await bookAppointment({
          business: world.business,
          service,
          customer,
          leadId: lead.id,
          startTime: start,
          source: "website",
          now: TEST_NOW,
        }),
      );
    }

    const cancelled = await cancelAppointment(world.business, booked[0].id, "Customer rescheduled");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.notes).toContain("Customer rescheduled");

    const { customer, lead } = await newCustomer(world, "+19085550198");
    const replacement = await bookAppointment({
      business: world.business,
      service,
      customer,
      leadId: lead.id,
      startTime: start,
      source: "website",
      now: TEST_NOW,
    });
    expect(replacement.status).toBe("requested");
  });

  it("completing an appointment completes its lead", async () => {
    const { customer, lead } = await newCustomer(world);
    const appointment = await bookAppointment({
      business: world.business,
      service: world.service("house-washing"),
      customer,
      leadId: lead.id,
      startTime: parseZonedDateTime(TUESDAY, "08:00", TZ).toISOString(),
      source: "website",
      now: TEST_NOW,
    });

    await setAppointmentStatus(world.business, appointment.id, "completed");

    const refreshed = await world.store.getLeadById(world.business.id, lead.id);
    expect(refreshed?.status).toBe("completed");
  });
});
