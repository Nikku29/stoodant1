import { defineConfig, devices } from "@playwright/test";

// Runs against the Firebase Hosting emulator serving the production build, with the functions and
// Firestore emulators behind /api/lead:  cd functions && npm run e2e
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:5000",
    ...devices["Pixel 7"],
    launchOptions: process.env["PLAYWRIGHT_CHROMIUM_PATH"] ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_PATH"] } : {},
  },
});
