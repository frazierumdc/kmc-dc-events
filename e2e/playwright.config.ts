import { defineConfig, devices } from "@playwright/test";

// Runs against a production build of apps/web, on WebKit (iPhone) and Chromium (Android).
export default defineConfig({
  testDir: "tests",
  globalSetup: "./build-variants.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    // The other specs feed the app through page.route, which WebKit can't see once a
    // service worker controls the page; sw.spec.ts allows it and serves its own files.
    serviceWorkers: "block",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "pnpm --filter @kmcdc/web build && pnpm --filter @kmcdc/web preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    // Sample messaging settings (D65), so Settings has Notifications; the tests never turn
    // them on, so nothing reaches Google.
    env: {
      WEB_APP_CONFIG: JSON.stringify({
        apiKey: "AIzaSyTest-key",
        appId: "1:000000000000:web:0000test",
        messagingSenderId: "000000000000",
        projectId: "demo-e2e",
      }),
      PUSH_PUBLIC_KEY: "BTestPublicKey-for-e2e_only",
    },
  },
});
