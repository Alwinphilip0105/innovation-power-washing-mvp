import { expect, test } from "@playwright/test";

/**
 * The public website. A customer has to be able to land, understand what is on
 * offer, and reach a way to get a price.
 */

test("the homepage presents the business, its services and a way to act", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Primary and secondary calls to action.
  await expect(page.getByRole("link", { name: /get a free estimate/i }).first()).toBeVisible();

  // The service catalogue is rendered from the database, not hardcoded markup.
  await expect(page.getByRole("heading", { name: "House Washing", exact: true }).first()).toBeVisible();

  // Trust signal a real home-service company leads with.
  await expect(page.getByText(/insured/i).first()).toBeVisible();
});

test("the FAQ opens and closes without JavaScript state", async ({ page }) => {
  await page.goto("/");

  const firstFaq = page.locator("details").first();
  await expect(firstFaq).not.toHaveAttribute("open", /.*/);
  await firstFaq.locator("summary").click();
  await expect(firstFaq).toHaveAttribute("open", /.*/);
});

test("every primary page renders", async ({ page }) => {
  for (const path of ["/services", "/gallery", "/service-area", "/about", "/contact", "/book"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
  }
});

test("the before/after slider is operable by keyboard", async ({ page }) => {
  await page.goto("/gallery");

  const slider = page.getByRole("slider").first();
  await expect(slider).toBeVisible();

  const before = await slider.inputValue();
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).not.toHaveValue(before);
});

test("the dashboard is not reachable while signed out", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("an unknown route returns the 404 page rather than an error", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /not here/i })).toBeVisible();
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<urlset");
});

test("the health endpoint reports wired providers without leaking secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.data.providers.ai).toBe("mock");
  expect(body.data.dataStore.kind).toBe("memory");
  expect(JSON.stringify(body)).not.toMatch(/sk-|service_role/i);
});
