import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.PLAYWRIGHT_SERVER_COMMAND ?? "npm run start",
    url: "http://127.0.0.1:4173/api/categories",
    env: { PORT: "4173" },
    reuseExistingServer: false,
    timeout: 20000,
  },
});
