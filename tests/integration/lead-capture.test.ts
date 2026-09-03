import { beforeEach, describe, expect, it } from "vitest";

import { getEmailOutbox } from "@/lib/notifications/providers";
import { leadFormSchema } from "@/lib/validation/schemas";
import { captureLead, captureWebsiteLead, getLeadDetail, updateLeadStatus } from "@/services/leads";
import { resetWorld, TEST_NOW, type World } from "@/tests/helpers/world";

const submission = {
  firstName: "Dana",
  lastName: "Alvarez",
  phone: "(908) 555-0190",
  email: "Dana.Alvarez@Example.com",
  street: "9 Chestnut Lane",
  city: "Warren",
  zip: "07059",
  serviceSlug: "house-washing",
  notes: "North side is green.",
};

describe("website lead -> database -> notification", () => {
  let world: World;

  beforeEach(() => {
    world = resetWorld(TEST_NOW);
  });

  it("creates the customer, address, lead and owner notification from one submission", async () => {
    const values = leadFormSchema.parse(submission);
    const result = await captureWebsiteLead(world.business, values);

    // Customer
    expect(result.customer.first_name).toBe("Dana");
    expect(result.customer.phone).toBe("+19085550190");
    expect(result.customer.email).toBe("dana.alvarez@example.com");

    // Address
    const addresses = await world.store.listAddressesByCustomer(result.customer.id);
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({ street: "9 Chestnut Lane", city: "Warren", state: "NJ" });

    // Lead, priced from the service record rather than guessed
    expect(result.lead.status).toBe("new");
    expect(result.lead.source).toBe("website");
    expect(result.lead.service_id).toBe(world.service("house-washing").id);
    expect(result.lead.estimated_value).toBeNull();

    // Owner notification + email
    const notifications = await world.store.listNotifications(world.business.id, { limit: 10 });
    const created = notifications.find((notification) => notification.type === "lead.created");
    expect(created?.title).toContain("Dana Alvarez");

    const outbox = getEmailOutbox();
    expect(outbox[0].to).toBe(world.business.settings.notifications.ownerEmail);
    expect(outbox[0].subject).toContain("New website lead");
  });

  it("de-duplicates a repeat submission for the same service instead of creating a second lead", async () => {
    const first = await captureWebsiteLead(world.business, leadFormSchema.parse(submission));
    const second = await captureWebsiteLead(
      world.business,
      leadFormSchema.parse({ ...submission, phone: "908-555-0190", notes: "Also the shed." }),
    );

    expect(second.deduplicated).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.lead.notes).toContain("North side is green.");
    expect(second.lead.notes).toContain("Also the shed.");

    const leads = await world.store.listLeads(world.business.id, { customerId: first.customer.id });
    expect(leads).toHaveLength(1);
  });

  it("creates a separate lead when the same customer asks about a different service", async () => {
    const first = await captureWebsiteLead(world.business, leadFormSchema.parse(submission));
    const second = await captureWebsiteLead(
      world.business,
      leadFormSchema.parse({ ...submission, serviceSlug: "concrete-cleaning" }),
    );

    expect(second.deduplicated).toBe(false);
    expect(second.lead.id).not.toBe(first.lead.id);
    expect(second.customer.id).toBe(first.customer.id);
  });

  it("matches an existing customer by email when the phone differs", async () => {
    await captureWebsiteLead(world.business, leadFormSchema.parse(submission));

    const byEmail = await captureLead({
      business: world.business,
      source: "referral",
      identity: { firstName: "Dana", email: "dana.alvarez@example.com" },
      serviceSlug: "fence-cleaning",
    });

    const customers = await world.store.listCustomers(world.business.id, { search: "dana" });
    expect(customers).toHaveLength(1);
    expect(byEmail.customer.id).toBe(customers[0].id);
  });

  it("builds a complete lead detail view for the CRM", async () => {
    const { lead } = await captureWebsiteLead(world.business, leadFormSchema.parse(submission));
    const detail = await getLeadDetail(world.business, lead.id);

    expect(detail).not.toBeNull();
    expect(detail!.customer.first_name).toBe("Dana");
    expect(detail!.service?.slug).toBe("house-washing");
    expect(detail!.addresses).toHaveLength(1);
    expect(detail!.appointments).toEqual([]);
  });

  it("returns null for a lead id that belongs to nobody", async () => {
    expect(await getLeadDetail(world.business, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("records a status change and leaves an analytics trail", async () => {
    const { lead } = await captureWebsiteLead(world.business, leadFormSchema.parse(submission));
    const updated = await updateLeadStatus(world.business, lead.id, "contacted");

    expect(updated.status).toBe("contacted");

    const events = await world.store.listAnalyticsEvents(world.business.id, { limit: 10 });
    const change = events.find((event) => event.name === "lead_status_changed");
    expect(change?.properties).toMatchObject({ from: "new", to: "contacted" });
  });
});
