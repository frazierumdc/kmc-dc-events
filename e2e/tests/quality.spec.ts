import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The Events screen's qualities, in real WebKit and Chromium: accessible (NFR-2, WCAG 2.2
// AA, checked by axe), fast (NFR-1), private (NFR-5), dark mode, Reduce Motion and the
// keyboard. Same golden schedule and clock as the Events specs (events-support.ts).
const golden = (name: string) =>
  readFileSync(new URL(`../../packages/domain/golden/${name}`, import.meta.url), "utf8");
const manifest = golden("manifest-v2.json");
const snapshotPath = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];

test.use({ timezoneId: "Asia/Tokyo" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
});

/**
 * Serves the golden schedule; `offline` makes the feed unreachable and the browser report
 * itself offline, as Airplane Mode does. The page itself still loads: these tests block
 * the service worker.
 */
async function serveFeed(page: Page, { offline = false } = {}) {
  if (offline)
    await page.addInitScript(
      "Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })",
    );
  await page.unrouteAll();
  await page.route("**/v2/feed/**", (route) => {
    if (offline) return route.abort("internetdisconnected");
    const url = new URL(route.request().url()).pathname;
    if (url.endsWith("/manifest.json")) return route.fulfill({ body: manifest });
    if (url === snapshotPath) return route.fulfill({ body: golden("snapshot-v2.json") });
    return route.fulfill({ status: 404 });
  });
}

const today = (page: Page) => page.getByRole("region", { name: "Today, October 13, 2026" });

/** WCAG 2.2 A and AA rules, nothing else. */
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const scheme of ["light", "dark"] as const) {
  test(`no WCAG 2.2 AA problems, ${scheme}: the list and a date tapped`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await serveFeed(page);
    await page.goto("/");
    await expect(today(page)).toBeVisible();
    expect(await audit(page)).toEqual([]);

    await page.getByRole("button", { name: /^Sunday, October 18/ }).click();
    await expect(page.getByRole("button", { name: /^Sunday, October 18/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(await audit(page)).toEqual([]);
  });
}

test("dark mode follows the phone (EV-22)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await serveFeed(page);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  expect(await page.evaluate("getComputedStyle(document.body).backgroundColor")).toBe(
    "rgb(0, 0, 0)",
  );
});

test("a second visit shows the list in under a second, online or offline (NFR-1)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  for (const offline of [false, true]) {
    await serveFeed(page, { offline });
    await page.reload();
    // Timed in the page on every frame: an expect() poll would add up to its interval. The
    // document's own timeline starts at this load; the fixed clock's performance.now() would
    // count from the first visit, through every step of the test.
    const shown = await page.waitForFunction(
      `[...document.querySelectorAll(".ui-day h2")].some((h) => h.textContent === "Today, October 13, 2026") &&
        document.timeline.currentTime`,
      undefined,
      { polling: "raf" },
    );
    const ms = (await shown.jsonValue()) as number;
    expect(ms, offline ? "offline" : "online").toBeLessThan(1000);
    if (offline) expect(await page.evaluate("navigator.onLine")).toBe(false);
  }
});

test("the app's JavaScript stays within 150 KB gzip (NFR-1)", async ({ page, request }) => {
  await page.goto("/");
  const scripts = page.locator('script[type="module"][src]');
  let total = 0;
  for (const script of await scripts.all()) {
    const body = await (await request.get((await script.getAttribute("src")) ?? "")).body();
    total += gzipSync(body).length;
  }
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(150 * 1024);
});

test("the app talks only to its own site: no tracking, no other servers (NFR-5)", async ({
  page,
  baseURL,
}) => {
  const others: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== baseURL) others.push(r.url());
  });
  await serveFeed(page);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  expect(others).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
});

test("Reduce Motion turns movement off (NFR-2)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveFeed(page);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  const seconds = await page.evaluate<number>(
    "parseFloat(getComputedStyle(document.querySelector('.ui-thumb')).transitionDuration)",
  );
  expect(seconds).toBeLessThan(0.01);
});

test("the filter and the dates work from the keyboard, with a visible focus ring", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  const prayers = page.getByRole("button", { name: "Prayers", exact: true });
  await prayers.focus();
  await page.keyboard.press("Enter");
  await expect(prayers).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate("getComputedStyle(document.activeElement).outlineStyle")).not.toBe(
    "none",
  );
  const sunday = page.getByRole("button", { name: /^Sunday, October 18/ });
  await sunday.focus();
  await page.keyboard.press("Space");
  await expect(sunday).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "Sunday, October 18, 2026" })).toBeVisible();
});
