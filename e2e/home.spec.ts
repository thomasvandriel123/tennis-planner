import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("shows the Dutch landing page by default", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Welkom bij de tennisplanner" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Inloggen" })).toBeVisible();
  });

  test("switches to English via the locale toggle", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // The button's accessible name is the lowercase locale code ("en"); it
    // only *looks* uppercase via CSS text-transform.
    await page.getByRole("button", { name: "en", exact: true }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { name: "Welcome to the tennis planner" })).toBeVisible();
  });

  test("sign-in page renders the email form", async ({ page }) => {
    await page.goto("/en/sign-in", { waitUntil: "networkidle" });
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  });
});
