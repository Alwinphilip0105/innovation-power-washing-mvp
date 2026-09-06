import { expect, test, type Page } from "@playwright/test";

/**
 * The primary customer journey, end to end:
 *
 *   website -> lead -> CRM -> lead detail -> status change
 *
 * This is the MVP's definition of done for the website and CRM, so it is
 * asserted through the real UI rather than the API.
 */

const DEMO = {
  email: "owner@innovationpowerwashing.com",
  password: "powerwash2026",
};

// Unique per run so a rerun against a warm server does not hit lead de-duplication.
function uniqueCustomer() {
  const suffix = String(Date.now()).slice(-4);
  return {
    firstName: "Testcase",
    lastName: `Reyes${suffix}`,
    phone: `973555${suffix.padStart(4, "0")}`,
    email: `testcase.reyes${suffix}@example.com`,
    street: `${suffix} Ramapo Avenue`,
    city: "Pompton Lakes",
    zip: "07442",
  };
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a customer submits the estimate form and it reaches the CRM", async ({ page }) => {
  const customer = uniqueCustomer();

  await page.goto("/contact");

  await page.getByLabel("First name").fill(customer.firstName);
  await page.getByLabel("Last name").fill(customer.lastName);
  await page.getByLabel("Phone").fill(customer.phone);
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Service address").fill(customer.street);
  await page.getByLabel("Town").fill(customer.city);
  await page.getByLabel("ZIP code").fill(customer.zip);

  await page.getByRole("button", { name: /get my free estimate/i }).click();

  // The customer gets an explicit confirmation, not a silent redirect.
  await expect(page.getByRole("heading", { name: /thanks, testcase/i })).toBeVisible();
  await expect(page.getByText(/call you within one business day/i)).toBeVisible();

  // The same lead is now visible to the business.
  await signIn(page);
  await page.goto("/dashboard/leads");

  const fullName = `${customer.firstName} ${customer.lastName}`;
  await expect(page.getByRole("link", { name: fullName })).toBeVisible();

  // Open the lead: contact details, address and status all present.
  await page.getByRole("link", { name: fullName }).click();
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
  await expect(page.getByText(customer.email)).toBeVisible();
  await expect(page.getByText(new RegExp(customer.street, "i"))).toBeVisible();

  // The owner can move it along.
  await page.getByLabel("Lead status").selectOption("contacted");
  await page.getByRole("button", { name: /update status/i }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();
});

test("the form rejects a bad phone number without losing what was typed", async ({ page }) => {
  await page.goto("/contact");

  await page.getByLabel("First name").fill("Testcase");
  await page.getByLabel("Last name").fill("Invalid");
  await page.getByLabel("Phone").fill("555-1234");
  await page.getByLabel("Email").fill("testcase.invalid@example.com");
  await page.getByLabel("Service address").fill("1 Ramapo Avenue");
  await page.getByLabel("Town").fill("Pompton Lakes");
  await page.getByLabel("ZIP code").fill("07442");

  await page.getByRole("button", { name: /get my free estimate/i }).click();

  await expect(page.getByText(/valid( US)? phone number/i)).toBeVisible();
  // Still on the form, with the other fields intact.
  await expect(page.getByLabel("First name")).toHaveValue("Testcase");
});

test("sign-in is reachable from the top bar with the demo account filled in", async ({ page }) => {
  await page.goto("/");

  // Moved out of the footer: on a demo, getting into the dashboard should not
  // require scrolling to the bottom of the page to find the way in.
  await page.getByRole("link", { name: /staff login/i }).click();
  await expect(page).toHaveURL(/\/login/);

  // Prefilled whenever the dev sign-in is in use, so the demo is one click.
  // A deployment holding real data runs Supabase Auth, where nothing is filled.
  await expect(page.getByLabel("Email")).toHaveValue("owner@innovationpowerwashing.com");
  await expect(page.getByLabel("Password")).toHaveValue("powerwash2026");

  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /today at a glance/i })).toBeVisible();
});

test("the owner can sign in and see a live dashboard", async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole("heading", { name: /today at a glance/i })).toBeVisible();

  // Seeded demo data means the dashboard is useful on first load, not empty.
  await expect(page.getByText("Leads this month")).toBeVisible();
  await expect(page.getByText("Upcoming jobs")).toBeVisible();
  await expect(page.getByRole("heading", { name: /recent leads/i })).toBeVisible();

  // Every dashboard section loads.
  for (const [path, heading] of [
    ["/dashboard/appointments", /appointments/i],
    ["/dashboard/conversations", /conversations/i],
    ["/dashboard/calls", /calls/i],
    ["/dashboard/estimates", /estimates/i],
    ["/dashboard/services", /services/i],
    ["/dashboard/settings", /settings/i],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 }), path).toBeVisible();
  }
});

test("signing out ends the session", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
