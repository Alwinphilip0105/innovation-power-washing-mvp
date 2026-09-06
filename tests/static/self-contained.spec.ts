import { expect, test, type Page } from "@playwright/test";

/**
 * The static export has to work with nothing behind it.
 *
 * These run against ./out on a dumb file server, so anything that would need a
 * route handler, a session or a database fails here rather than in production.
 * The strongest assertion in the file is the negative one: no request leaves
 * the origin. If the in-browser transport were ever swapped back for `fetch`,
 * the demo would still appear to work locally against a dev server and would
 * break the moment it was published — that is exactly what this catches.
 */
const ORIGIN = "http://localhost:4321";

/** Records every request the page makes to somewhere other than this host. */
function trackOffOrigin(page: Page): string[] {
  const offOrigin: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      offOrigin.push(url);
    }
  });
  return offOrigin;
}

test("the chat answers with no server and no network", async ({ page }) => {
  const offOrigin = trackOffOrigin(page);

  await page.goto("/");
  await page.getByRole("button", { name: /chat with/i }).click();

  const panel = page.getByRole("dialog");
  await panel.getByLabel("Your message").fill("I'd like to book a house wash.");
  await panel.getByRole("button", { name: /send message/i }).click();

  // A real assistant turn, offering concrete times drawn from the schedule -
  // all computed in the page.
  await expect(panel.getByText(/at \d{1,2}:\d{2} (AM|PM)/)).toBeVisible({ timeout: 20_000 });

  expect(offOrigin, `the export called out to: ${offOrigin.join(", ")}`).toEqual([]);
});

test("the booking form loads real availability and books, in the browser", async ({ page }) => {
  const offOrigin = trackOffOrigin(page);

  await page.goto("/book");

  // Slots come from the booking rules running client-side, not from a fixture.
  const slot = page.getByRole("button", { name: /^\d{1,2}:\d{2} (AM|PM)$/ }).first();
  await expect(slot).toBeVisible({ timeout: 20_000 });
  await slot.click();

  const details = page.getByRole("region", { name: /your details/i });
  await details.getByLabel("First name").fill("Dana");
  await details.getByLabel("Phone").fill("9735550142");
  await details.getByLabel("Service address").fill("18 Wanaque Avenue");
  await details.getByLabel("Town").fill("Pompton Lakes");
  await details.getByLabel("ZIP").fill("07442");
  await details.getByRole("button", { name: /confirm this appointment/i }).click();

  await expect(page.getByRole("heading", { name: /you're on the schedule/i })).toBeVisible({
    timeout: 20_000,
  });

  expect(offOrigin, `the export called out to: ${offOrigin.join(", ")}`).toEqual([]);
});

test("the Call button runs a whole demo call in the page", async ({ page }) => {
  const offOrigin = trackOffOrigin(page);

  await page.goto("/services");
  await page.getByRole("button", { name: /call the ai agent/i }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Thanks for calling/i)).toBeVisible({ timeout: 20_000 });

  const input = dialog.getByLabel(/type what the caller says/i);
  await expect(input).toBeEnabled({ timeout: 20_000 });
  await input.fill("I need my driveway cleaned.");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText(/driveway|concrete|estimate|quote/i).first()).toBeVisible({
    timeout: 20_000,
  });

  expect(offOrigin, `the export called out to: ${offOrigin.join(", ")}`).toEqual([]);
});

test("sign-in and the dashboard point at the real deployment", async ({ page }) => {
  await page.goto("/");

  // These genuinely cannot be static, so they must leave the site rather than
  // 404 against a host that has no such page.
  const signIn = page.getByRole("link", { name: /staff login/i });
  await expect(signIn).toHaveAttribute("href", /^https?:\/\/.+\/login$/);
});

test("every exported page is a real file, not a client-side route", async ({ page }) => {
  for (const path of ["/", "/services", "/book", "/gallery", "/service-area", "/about", "/contact", "/demo/voice"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should be served as a file`).toBe(200);
  }

  // robots and the sitemap are emitted as files too.
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const response = await page.request.get(path);
    expect(response.status(), `${path} should exist`).toBe(200);
  }
});
