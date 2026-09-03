import { expect, test } from "@playwright/test";

/**
 * The two AI-facing journeys:
 *   - pick a real opening and book it
 *   - talk to the assistant and have it do something real
 */

function uniqueCustomer() {
  const suffix = String(Date.now()).slice(-4);
  return {
    firstName: "Booker",
    lastName: `Quinn${suffix}`,
    phone: `973556${suffix.padStart(4, "0")}`,
    street: `${suffix} Wanaque Avenue`,
    city: "Pompton Lakes",
    zip: "07442",
  };
}

test("a customer picks a real opening and books it", async ({ page }) => {
  const customer = uniqueCustomer();

  await page.goto("/book");

  // Step 2 loads genuine availability from the API.
  const slot = page.getByRole("button", { name: /^\d{1,2}:\d{2} (AM|PM)$/ }).first();
  await expect(slot).toBeVisible({ timeout: 20_000 });
  const slotLabel = (await slot.textContent())?.trim();
  await slot.click();

  // The chosen time is held and shown back.
  await expect(page.getByText(new RegExp(`Holding .* ${slotLabel}`))).toBeVisible();

  // /book carries two forms - the scheduler and the "rather have us call you"
  // aside - so scope to the scheduler's own section.
  const details = page.getByRole("region", { name: /your details/i });
  await details.getByLabel("First name").fill(customer.firstName);
  await details.getByLabel("Last name").fill(customer.lastName);
  await details.getByLabel("Phone").fill(customer.phone);
  await details.getByLabel("Service address").fill(customer.street);
  await details.getByLabel("Town").fill(customer.city);
  await details.getByLabel("ZIP").fill(customer.zip);

  await details.getByRole("button", { name: /confirm this appointment/i }).click();

  await expect(page.getByRole("heading", { name: /you're on the schedule/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/text confirmation/i)).toBeVisible();
});

test("the booking form will not submit without a chosen time", async ({ page }) => {
  await page.goto("/book");

  const submit = page.getByRole("button", { name: /confirm this appointment/i });
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/choose a time above/i)).toBeVisible();
});

test("the chat assistant answers and offers real availability", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /chat with/i }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();

  // The greeting is the business's configured greeting.
  await expect(panel.getByText(/what you need cleaned|how can (we|i) help/i)).toBeVisible();

  await panel.getByLabel("Your message").fill("I'd like to book a house wash.");
  await panel.getByRole("button", { name: /send message/i }).click();

  // The assistant offers concrete times, drawn from the real schedule.
  await expect(panel.getByText(/at \d{1,2}:\d{2} (AM|PM)/)).toBeVisible({ timeout: 20_000 });
});

test("the assistant will not invent a price for a quote-only service", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /chat with/i }).click();
  const panel = page.getByRole("dialog");

  await panel.getByLabel("Your message").fill("How much to clean my roof?");
  await panel.getByRole("button", { name: /send message/i }).click();

  const reply = panel.locator("p").filter({ hasText: /estimate|look|quote/i }).last();
  await expect(reply).toBeVisible({ timeout: 20_000 });
  await expect(reply).not.toHaveText(/\$\s?\d/);
});

test("the assistant hands off to a person when asked", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /chat with/i }).click();
  const panel = page.getByRole("dialog");

  await panel.getByLabel("Your message").fill("Can someone actually call me back? 973-555-0188");
  await panel.getByRole("button", { name: /send message/i }).click();

  await expect(panel.getByText(/call you back/i)).toBeVisible({ timeout: 20_000 });
});
