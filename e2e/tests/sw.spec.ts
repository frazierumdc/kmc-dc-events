import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";
import { startSwServer } from "../sw-server.ts";

// The service worker in real WebKit and Chromium (EV-21, C-11): offline after the first
// visit, a new version applied with no banner (at once just after opening, otherwise on
// the next open), with nothing said, and the kill switch. Builds a, b
// and kill come from build-variants.ts; the server switches between them as a deploy
// would.
const test = base.extend<{ server: Awaited<ReturnType<typeof startSwServer>> }>({
  // Playwright reads the fixtures a fixture needs from this pattern; this one needs none.
  // eslint-disable-next-line no-empty-pattern
  server: async ({}, use) => {
    const server = await startSwServer("a");
    await use(server);
    await server.close();
  },
});

test.use({ timezoneId: "Asia/Tokyo", serviceWorkers: "allow" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
});

const today = (page: Page) => page.getByRole("region", { name: "Today, October 13, 2026" });
/** The build running: Settings shows it; <html> carries it too. */
const build = (page: Page, id: string) => page.locator(`html[data-build="${id}"]`);

/** Opens the app and waits until the service worker controls the page. */
async function openControlled(page: Page, url: string) {
  await page.goto(url);
  await expect(today(page)).toBeVisible();
  await page.waitForFunction("navigator.serviceWorker.controller !== null");
}

/** Asks the browser to look for a new service worker now. */
async function lookForUpdate(page: Page) {
  await page.evaluate("navigator.serviceWorker.getRegistration().then((r) => r.update())");
}

// "No connection" is the site going down: WebKit's offline emulation also blocks the
// service worker's own answers.
test("after the first visit the app opens with no connection, links included", async ({
  page,
  server,
}) => {
  await openControlled(page, server.url);
  await server.close();
  await page.reload();
  await expect(today(page)).toBeVisible();
  await page.goto(`${server.url}/e/some-event`);
  await expect(today(page)).toBeVisible();
});

test("a new version found just after opening applies at once, with nothing said (EV-21)", async ({
  page,
  server,
}) => {
  await openControlled(page, server.url);
  await expect(build(page, "a")).toBeVisible();
  server.use("b");
  await lookForUpdate(page);
  await expect(build(page, "b")).toBeVisible();
  await expect(today(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Update" })).toHaveCount(0);
  // No message about the app, then or a moment later.
  await page.waitForTimeout(1_000);
  await expect(page.locator(".ui-toast")).toHaveCount(0);
});

test("a new version found well into reading waits for the next open", async ({ page, server }) => {
  await openControlled(page, server.url);
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:20Z"));
  server.use("b");
  await lookForUpdate(page);
  await page.waitForFunction(
    "navigator.serviceWorker.getRegistration().then((r) => r?.waiting !== null)",
  );
  await expect(build(page, "a")).toBeVisible();
  await page.reload();
  await expect(build(page, "b")).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(page.locator(".ui-toast")).toHaveCount(0);
});

test("the kill switch removes the service worker and its files", async ({ page, server }) => {
  await openControlled(page, server.url);
  server.use("kill");
  await page.reload();
  await expect(build(page, "kill")).toBeVisible();
  await expect
    .poll(() => page.evaluate("navigator.serviceWorker.getRegistrations().then((r) => r.length)"))
    .toBe(0);
  await expect.poll(() => page.evaluate("caches.keys().then((k) => k.length)")).toBe(0);
  await expect(today(page)).toBeVisible();
});

// A picture that isn't on the site yet was once answered with the app's page, which phones
// then kept and showed in its place for good (another center's poster on prod, 16 November 2026).
test("the app keeps only real pictures, and drops a kept answer that isn't one (EV-11, EV-44)", async ({
  page,
  server,
}) => {
  await openControlled(page, server.url);
  const at = "/v2/feed/pictures/0000000000000001-story.jpg";
  const type = () =>
    page.evaluate<string>(`fetch("${at}").then((r) => r.headers.get("content-type") ?? "")`);
  // Not on the site: this server answers with the app's page, as Hosting did, and it isn't kept.
  expect(await type()).toContain("text/html");
  const picture = readFileSync(new URL("../../brand/images/pwa-192x192.png", import.meta.url));
  server.addPicture(at, picture);
  expect(await type()).toBe("image/png");
  // A phone that kept the app's page before this fix gets the picture.
  const other = "/v2/feed/pictures/0000000000000002-story.jpg";
  await page.evaluate(
    `caches.open("event-pictures").then((c) => c.put("${other}", new Response("<html></html>", { headers: { "content-type": "text/html" } })))`,
  );
  server.addPicture(other, picture);
  expect(
    await page.evaluate<string>(
      `fetch("${other}").then((r) => r.headers.get("content-type") ?? "")`,
    ),
  ).toBe("image/png");
  // Kept now, so it shows with no connection.
  await server.close();
  expect(await type()).toBe("image/png");
});
