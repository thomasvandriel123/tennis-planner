import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Some sandboxed dev environments pre-install Chromium outside Playwright's
// usual cache and block the browser download step; use it when present,
// otherwise fall back to Playwright's normal (npx playwright install) browser.
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
});
