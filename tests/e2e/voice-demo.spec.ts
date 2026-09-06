import { expect, test, type Page } from "@playwright/test";

/**
 * The voice demo, driven through its typing fallback.
 *
 * A headless browser has no microphone and no speech engine, so the spoken half
 * cannot be exercised here. Everything below the microphone can: turn-taking,
 * the assistant's answer, and the call landing in the CRM are the same code on
 * both paths, and the typing fallback is a path real users take anyway.
 */

/** Turning the voice off removes the one thing headless Chromium cannot do. */
async function startCallSilently(page: Page) {
  await page.getByRole("button", { name: /voice on/i }).click();
  await expect(page.getByRole("button", { name: /voice off/i })).toBeVisible();
  await page.getByRole("button", { name: /start the call/i }).click();
  await expect(page.getByText(/Thanks for calling/i)).toBeVisible();
}

test("a typed call reaches the assistant and is written to the CRM", async ({ page }) => {
  await page.goto("/demo/voice");

  await expect(page.getByRole("heading", { name: /talk to the ai phone agent/i })).toBeVisible();

  const input = page.getByLabel(/type what the caller says/i);
  await expect(input).toBeDisabled();

  await startCallSilently(page);
  await expect(input).toBeEnabled();

  await input.fill("I'd like to book a house wash.");
  await page.getByRole("button", { name: "Send" }).click();

  // A real answer, built from real availability.
  await expect(page.getByText(/at \d{1,2}:\d{2} (AM|PM)/)).toBeVisible({ timeout: 20_000 });

  // The turn was handed back rather than left hanging, so the caller can talk on.
  await expect(input).toBeEnabled();

  await page.getByRole("button", { name: /hang up/i }).click();

  await expect(page.getByText(/Call written to the CRM/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Enquiry only/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open it in the dashboard/i })).toBeVisible();
});

test("a browser without speech recognition is told, and can still run the demo", async ({ page }) => {
  // Firefox and Safari land here. The demo has to degrade to typing rather than
  // offering a microphone that will never work.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  await page.goto("/demo/voice");

  await expect(page.getByText(/only works in Chrome and Edge/i)).toBeVisible();

  await startCallSilently(page);

  const input = page.getByLabel(/type what the caller says/i);
  await expect(input).toBeEnabled();

  await input.fill("Do you clean paver driveways?");
  await page.getByRole("button", { name: "Send" }).click();

  // The reply arrives and the turn comes back, with no microphone anywhere.
  await expect(page.getByText(/paver|driveway|concrete/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(input).toBeEnabled();
});

test("the call controls are inert until a call is started", async ({ page }) => {
  await page.goto("/demo/voice");

  await expect(page.getByRole("button", { name: /start the call/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /hang up/i })).toHaveCount(0);
  await expect(page.getByLabel(/type what the caller says/i)).toBeDisabled();
});
