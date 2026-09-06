import { expect, test } from "@playwright/test";

/**
 * The "Call" buttons on the marketing site place a demo call to the agent
 * rather than dialling a number nobody answers.
 *
 * A headless browser has no microphone, so this covers the part that is not
 * the microphone: the button opens the call, the call starts on its own
 * without a second click, and the conversation is the real one.
 *
 * There are two such buttons on this page - the header's, shown only on narrow
 * viewports, and the CTA band's - and they share an accessible name because
 * they do the same thing. `.first()` takes whichever the viewport shows first.
 */
test("the CTA call button places a demo call that starts on its own", async ({ page }) => {
  await page.goto("/services");

  await page.getByRole("button", { name: /call the ai agent/i }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /calling innovation power washing/i })).toBeVisible();

  // The point of the button: no "Start the call" step. The agent has already
  // greeted the caller by the time the dialog is up.
  await expect(dialog.getByText(/Thanks for calling/i)).toBeVisible({ timeout: 20_000 });

  // The real number is still one click away for anyone who wanted a person.
  await expect(dialog.getByRole("link", { name: /\(973\)/ })).toBeVisible();

  const input = dialog.getByLabel(/type what the caller says/i);
  await expect(input).toBeEnabled({ timeout: 20_000 });

  await input.fill("What do you charge to wash a house?");
  await dialog.getByRole("button", { name: "Send" }).click();

  // A genuine answer from the assistant, not a canned string in the dialog.
  await expect(dialog.getByText(/estimate|quote|price|look/i).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("the call dialog closes on Escape", async ({ page }) => {
  await page.goto("/services");

  await page.getByRole("button", { name: /call the ai agent/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
