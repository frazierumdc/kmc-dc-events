import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Settings (EV-41): the app, Add to Home Screen (which opens /get-app, IN-10), Privacy (IN-9) and
// Share the app, in real WebKit and Chromium. Same golden schedule and clock
// as the Events specs (events-support.ts).
const golden = (name: string) =>
  readFileSync(new URL(`../../packages/domain/golden/${name}`, import.meta.url), "utf8");
const manifest = golden("manifest-v2.json");
const snapshotPath = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];

test.use({ timezoneId: "Asia/Tokyo" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
  await page.route("**/v2/feed/**", (route) => {
    const url = new URL(route.request().url()).pathname;
    if (url.endsWith("/manifest.json")) return route.fulfill({ body: manifest });
    if (url === snapshotPath) return route.fulfill({ body: golden("snapshot-v2.json") });
    return route.fulfill({ status: 404 });
  });
});

async function openInfo(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Today, October 13, 2026" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  const info = page.getByRole("dialog", { name: "Settings" });
  await expect(info).toBeVisible();
  return info;
}

/**
 * WCAG 2.2 A and AA rules, nothing else, once the sheets have finished opening: mid-slide,
 * axe skips what is still below the screen (scroll-driven fades never finish, so not those).
 * The menu picture's faded last row is left out: text in a picture has no contrast
 * requirement (WCAG 1.4.3, incidental), and it is faded on purpose, as Safari fades its menu.
 */
async function audit(page: Page) {
  await page.evaluate(`Promise.all(
    document
      .getAnimations()
      .filter((a) => a.timeline instanceof DocumentTimeline && a.effect.getTiming().iterations !== Infinity)
      .map((a) => a.finished),
  )`);
  const { violations } = await new AxeBuilder({ page })
    .exclude(".ui-pic-row[data-dim]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("Settings shows when the schedule was updated, its rows and the version (EV-41, NT-30)", async ({
  page,
}) => {
  const info = await openInfo(page);
  await expect(info.getByText("Schedule updated October 9, 2026, 11:00 AM")).toBeVisible();
  await expect(info.getByRole("button", { name: /^Notifications.*Off$/ })).toBeVisible();
  await expect(
    info.getByRole("link", { name: /Add to (Home|home) (Screen|screen)/ }),
  ).toBeVisible();
  await expect(info.getByRole("button", { name: "Privacy" })).toBeVisible();
  await expect(info.getByRole("button", { name: /Share the app/ })).toBeVisible();
  await expect(info.getByRole("listitem")).toHaveCount(0);
  await expect(info.getByText(/^Version /)).toBeAttached();
  // The end of the list no longer says when the schedule was updated (EV-17).
  await page.getByRole("button", { name: "Close" }).click();
  await expect(info).toBeHidden();
  await expect(page.getByText(/^Schedule updated October/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
});

test("Add to Home Screen opens /get-app, with Back to the app (IN-10)", async ({ page }) => {
  // Hosting serves /get-app itself; vite preview needs the slash, so /get-app gets /get-app/'s page.
  await page.route("**/get-app", async (route) => {
    await route.fulfill({ response: await route.fetch({ url: `${route.request().url()}/` }) });
  });
  const info = await openInfo(page);
  await info.getByRole("link", { name: /Add to (Home|home) (Screen|screen)/ }).click();
  await expect(page).toHaveURL(/\/get-app\/?$/);
  await expect(page.getByRole("link", { name: "Open the app" })).toBeVisible();
  await page.getByRole("link", { name: "‹ Back to the app" }).click();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const)
  test(`no WCAG 2.2 AA problems in Settings, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openInfo(page);
    expect(await audit(page)).toEqual([]);
  });

test("Privacy opens inside Settings, and /privacy is its own page with the same words (IN-9)", async ({
  page,
}) => {
  const info = await openInfo(page);
  await info.getByRole("button", { name: "Privacy" }).click();
  const privacy = page.getByRole("dialog", { name: "Privacy" });
  await expect(privacy.getByText("KMC DC Events collects no data about you.")).toBeVisible();
  await expect(privacy.getByRole("link", { name: "contact@example.org" })).toBeVisible();
  expect(await audit(page)).toEqual([]);
  await privacy.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  await page.goto("/privacy/");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page.getByText("KMC DC Events collects no data about you.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the app ›" })).toHaveAttribute("href", "/");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

// Notifications (NT-17 – NT-19): each phone's starting screen, as the tests' build has sample
// messaging settings. Nothing here turns them on, so nothing asks the phone or reaches Google.
// Headless Chrome reports notifications refused unless they are granted.
async function openNotifications(page: Page) {
  const settings = await openInfo(page);
  await settings.getByRole("button", { name: /^Notifications/ }).click();
  return page.getByRole("dialog", { name: "Notifications" });
}

for (const scheme of ["light", "dark"] as const) {
  test(`Notifications on iPhone in Safari, or refused on Android, with no WCAG 2.2 AA problems, ${scheme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    const screen = await openNotifications(page);
    if (info.project.name === "iphone") {
      // Safari, not the Home Screen app: notifications need the app added first (NT-19).
      await expect(screen.getByText("Add the app to your Home Screen first")).toBeVisible();
      await expect(screen.getByRole("link", { name: "Add to Home Screen" })).toBeVisible();
    } else {
      // Refused: how to allow them in the phone's settings, and nothing that asks (NT-18).
      await expect(screen.getByText("Notifications are off for this app")).toBeVisible();
      await expect(screen.getByRole("listitem")).toHaveCount(3);
      await expect(screen.getByRole("button", { name: "Turn on notifications" })).toHaveCount(0);
    }
    await expect(screen.getByRole("switch")).toHaveCount(0);
    expect(await audit(page)).toEqual([]);
    await screen.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test(`Notifications before they are on, on Android, with no WCAG 2.2 AA problems, ${scheme}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "android", "iPhone's Safari shows the Home Screen step");
    // Headless Chrome refuses notifications even when granted, so it reports not asked yet.
    await page.addInitScript(() => {
      const { Notification } = globalThis as unknown as { Notification: object };
      Object.defineProperty(Notification, "permission", { get: () => "default" });
    });
    await page.emulateMedia({ colorScheme: scheme });
    const screen = await openNotifications(page);
    // The same screen as when they are on, its switch off (NT-17).
    await expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // The kinds stay there to see, but don't open until notifications are on.
    await expect(screen.getByRole("button", { name: /^Classes/ })).toBeDisabled();
    await expect(screen.getByText(/reminded before them and told if they change/)).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });
}

// Notify me (NT-13, NT-48): in an event's panel where notifications can be on; not in
// iPhone's Safari, where they need the Home Screen app.
for (const scheme of ["light", "dark"] as const)
  test(`Notify me in an event's panel, with no WCAG 2.2 AA problems, ${scheme}`, async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      const { Notification } = globalThis as unknown as { Notification?: object };
      if (Notification) Object.defineProperty(Notification, "permission", { get: () => "default" });
    });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Today, October 13, 2026" })).toBeVisible();
    await page.locator("main li a").first().click();
    const panel = page.locator("dialog[open]");
    await expect(panel.getByRole("heading", { level: 2 })).toBeVisible();
    const toggle = panel.getByRole("switch", { name: "Notify me", exact: true });
    if (info.project.name === "iphone") {
      await expect(toggle).toHaveCount(0);
      return;
    }
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    // The line under it says what this event sends (NT-48).
    await expect(panel.locator("#ui-follow-detail")).toContainText(
      /^A reminder (the day|a week and a day) before.*if (it|one) changes$/,
    );
    expect(await audit(page)).toEqual([]);
  });

// Add events (NT-22, option E, owner, 13 November 2026): Notifications has a row for each
// of the list's kinds; Prayers opens every prayer, one is switched on there, and the row then
// counts it. Your events (NT-47, option B, owner, 17 November 2026) then lists it with the
// reminders it sends, and its switch there stops following it, the card staying until the
// screen is left.
for (const scheme of ["light", "dark"] as const)
  test(`Add events: open Prayers and follow one, then Your events, with no WCAG 2.2 AA problems, ${scheme}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "android", "iPhone's Safari shows the Home Screen step");
    await page.addInitScript(() => {
      const { Notification } = globalThis as unknown as { Notification: object };
      Object.defineProperty(Notification, "permission", { get: () => "granted" });
      if (localStorage.getItem("kmcdc.notifications") === null)
        localStorage.setItem(
          "kmcdc.notifications",
          JSON.stringify({ on: true, token: "t".repeat(40), lists: [], follows: [] }),
        );
    });
    const asked: unknown[] = [];
    await page.route("**/notifyLists", (route) => {
      asked.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, body: "{}" });
    });
    await page.emulateMedia({ colorScheme: scheme });
    const screen = await openNotifications(page);
    // No switch per event type (owner, 13 November): only this phone's.
    await expect(screen.getByRole("switch")).toHaveCount(1);
    await expect(screen.getByText(/^No events yet\./)).toBeVisible();
    const prayers = screen.getByRole("button", { name: /^Prayers/ });
    await expect(prayers).toContainText("Following 0 of");
    expect(await audit(page)).toEqual([]);

    await prayers.click();
    const add = page.getByRole("dialog", { name: "Prayers" });
    expect(await audit(page)).toEqual([]);
    const one = add.getByRole("switch", { name: "Wishfulfilling Jewel with Tsog" });
    await one.click();
    await expect(one).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toMatchObject({ join: [expect.stringMatching(/^(class|event)-/)], leave: [] });

    await add.getByRole("button", { name: "Notifications" }).click();
    const again = page.getByRole("dialog", { name: "Notifications" });
    await expect(again.getByRole("button", { name: /^Prayers/ })).toContainText("Following 1 of");
    const card = again.locator(".ui-follow-row");
    await expect(card).toHaveCount(1);
    await expect(card.locator(".ui-follow-reminders")).toHaveText(
      /^(Day before|Week before and day before)$/,
    );
    expect(await audit(page)).toEqual([]);
    const mine = again.getByRole("switch", { name: "Wishfulfilling Jewel with Tsog" });
    await mine.click();
    await expect(mine).toHaveAttribute("aria-checked", "false");
    await expect(card).toHaveCount(1);
    await expect(again.getByRole("button", { name: /^Prayers/ })).toContainText("Following 0 of");
    await expect.poll(() => asked.length).toBe(2);
  });

// A followed event that has left the schedule is dropped, and its list is left (NT-17).
test("an event followed that is no longer on the schedule is dropped", async ({ page }, info) => {
  test.skip(info.project.name !== "android", "iPhone's Safari shows the Home Screen step");
  await page.addInitScript(() => {
    const { Notification } = globalThis as unknown as { Notification: object };
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    if (localStorage.getItem("kmcdc.notifications") === null)
      localStorage.setItem(
        "kmcdc.notifications",
        JSON.stringify({
          on: true,
          token: "t".repeat(40),
          lists: ["type-class", "event-gone"],
          follows: [{ list: "event-gone", title: "Unwind the Mind", detail: "Tuesday" }],
        }),
      );
  });
  const asked: unknown[] = [];
  await page.route("**/notifyLists", (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, body: "{}" });
  });
  const screen = await openNotifications(page);
  await expect(screen.getByText("Unwind the Mind")).toHaveCount(0);
  // The event left, and the old Classes list too: events are followed one by one now.
  await expect
    .poll(() => asked)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ join: [], leave: ["event-gone"] }),
        expect.objectContaining({ join: [], leave: ["type-class"] }),
      ]),
    );
});
