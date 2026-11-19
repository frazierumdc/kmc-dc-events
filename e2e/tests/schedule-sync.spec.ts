import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Keeping the schedule on the phone (EV-18, EV-19), in real WebKit and Chromium with real
// IndexedDB. The golden schema 2 files are the schedule; a newer one moves Tuesday Rest and
// Reflect from 6:00 to 6:30 PM.
const golden = (name: string) =>
  readFileSync(new URL(`../../packages/domain/golden/${name}`, import.meta.url), "utf8");

interface Feed {
  manifest: string;
  path: string;
  snapshot: string;
}

const first: Feed = (() => {
  const manifest = golden("manifest-v2.json");
  const path = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];
  return { manifest, path, snapshot: golden("snapshot-v2.json") };
})();

const newer: Feed = (() => {
  const version = "20261010T120000Z-0000beef";
  const path = `/v2/feed/snapshots/${version}.json`;
  const manifest = { ...(JSON.parse(first.manifest) as object), version, snapshots: { "2": path } };
  const snapshot = JSON.parse(first.snapshot) as {
    version: string;
    events: { title: string; start: string; end: string | null }[];
  };
  snapshot.version = version;
  for (const e of snapshot.events)
    if (e.title === "Tuesday Rest and Reflect") {
      e.start = "2026-10-13T18:30:00-04:00";
      e.end = "2026-10-13T19:00:00-04:00";
    }
  return { manifest: JSON.stringify(manifest), path, snapshot: JSON.stringify(snapshot) };
})();

/** Serves `feed`; the manifest answers after `delayMs`; null blocks the schedule files. */
async function serve(page: Page, feed: Feed | null, delayMs = 0) {
  await page.unrouteAll();
  await page.route("**/v2/feed/**", async (route) => {
    if (!feed) return route.abort("internetdisconnected");
    const url = new URL(route.request().url()).pathname;
    if (url.endsWith("/manifest.json")) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return route.fulfill({ body: feed.manifest });
    }
    if (url === feed.path) return route.fulfill({ body: feed.snapshot });
    return route.fulfill({ status: 404 });
  });
}

const today = (page: Page) => page.getByRole("region", { name: "Today, October 13, 2026" });

test.use({ timezoneId: "Asia/Tokyo" });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
});

test("a second visit with the schedule unreachable shows the stored list", async ({ page }) => {
  await serve(page, first);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  await serve(page, null);
  await page.reload();
  await expect(today(page)).toContainText("Tuesday Rest and Reflect");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a schedule an older app kept without its kinds is downloaded again (D45)", async ({
  page,
}) => {
  await serve(page, first);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  // What an older app left: the schedule as it had read it, without the categories' kinds.
  const old = JSON.parse(first.snapshot) as { site: Record<string, unknown> };
  delete old.site.categoryKinds;
  const kept = JSON.stringify({ manifest: JSON.parse(first.manifest) as unknown, snapshot: old });
  await page.evaluate(`new Promise((resolve, reject) => {
    const drop = indexedDB.deleteDatabase("kmc-dc-events");
    drop.onerror = reject;
    drop.onsuccess = () => {
      const open = indexedDB.open("kmc-dc-events", 1);
      open.onerror = reject;
      open.onupgradeneeded = () => open.result.createObjectStore("schedule");
      open.onsuccess = () => {
        const tx = open.result.transaction("schedule", "readwrite");
        tx.objectStore("schedule").put(${kept}, "current");
        tx.oncomplete = () => { open.result.close(); resolve(); };
      };
    };
  })`);
  await page.reload();
  await expect(today(page).locator(".ui-row").first()).toHaveAttribute("data-kind", "special");
  await page.getByRole("button", { name: "Classes", exact: true }).click();
  await expect(today(page)).toContainText("Tuesday Rest and Reflect");
});

test("a newer schedule on opening is applied silently (EV-18, EV-19)", async ({ page }) => {
  await serve(page, first);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  await serve(page, newer);
  await page.reload();
  await expect(today(page)).toContainText("6:30 PM to 7:00 PM");
  await expect(page.locator(".ui-toast")).toHaveCount(0);
  await expect(page.getByText("Schedule updated", { exact: true })).toHaveCount(0);
});

test("a newer schedule that comes while reading is applied silently and keeps the place (EV-19)", async ({
  page,
}) => {
  await serve(page, first);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  await serve(page, newer, 2500);
  await page.reload();
  // The stored schedule shows at once, without waiting for the network (EV-18).
  await expect(today(page)).toContainText("6:00 PM to 6:30 PM", { timeout: 2000 });
  // The reader moves to Saturday before the newer schedule comes.
  const saturday = page.getByRole("button", { name: /^Saturday, October 17/ });
  await saturday.click();
  await expect(saturday).toHaveAttribute("aria-current", "true");
  await expect(today(page)).toContainText("6:30 PM to 7:00 PM", { timeout: 5000 });
  await expect(saturday).toHaveAttribute("aria-current", "true");
  // Saturday still starts just under the controls.
  const gap = await page.evaluate<number>(
    `document.getElementById("day-2026-10-17").parentElement.getBoundingClientRect().top -
      document.querySelector(".ui-controls").getBoundingClientRect().bottom`,
  );
  expect(Math.abs(gap)).toBeLessThan(40);
  // Nothing is said.
  await expect(page.locator(".ui-toast")).toHaveCount(0);
});

// ---- Quiet and honest (NT-5, NT-6) ----

const gone: Feed = (() => {
  const version = "20261010T130000Z-0000dead";
  const path = `/v2/feed/snapshots/${version}.json`;
  const manifest = { ...(JSON.parse(first.manifest) as object), version, snapshots: { "2": path } };
  const snapshot = JSON.parse(first.snapshot) as { version: string; events: { title: string }[] };
  snapshot.version = version;
  snapshot.events = snapshot.events.filter((e) => e.title !== "Tuesday Rest and Reflect");
  return { manifest: JSON.stringify(manifest), path, snapshot: JSON.stringify(snapshot) };
})();

/** The reader comes back to the app, which checks the site. */
const comeBack = (page: Page) =>
  page.evaluate(`document.dispatchEvent(new Event("visibilitychange"))`);

test("an open event that moves says Updated just now (NT-5)", async ({ page }) => {
  await serve(page, first);
  await page.goto("/");
  await today(page)
    .getByRole("link", { name: /Tuesday Rest and Reflect/ })
    .click();
  const panel = page.getByRole("dialog", { name: "Tuesday Rest and Reflect" });
  await expect(panel).toContainText("6:00 PM to 6:30 PM Eastern");
  await expect(panel.getByRole("status")).toHaveText("");
  await serve(page, newer);
  await comeBack(page);
  await expect(panel).toContainText("6:30 PM to 7:00 PM Eastern");
  await expect(panel.getByRole("status")).toHaveText("Updated just now");
});

test("an event cancelled while open: the panel stays, says so and offers only Close (NT-5)", async ({
  page,
}) => {
  await serve(page, first);
  await page.goto("/");
  await today(page)
    .getByRole("link", { name: /Tuesday Rest and Reflect/ })
    .click();
  const panel = page.getByRole("dialog", { name: "Tuesday Rest and Reflect" });
  await expect(panel).toBeVisible();
  await serve(page, gone);
  await comeBack(page);
  await expect(panel.getByRole("status")).toContainText("This event is no longer on the schedule");
  await expect(panel.getByRole("link")).toHaveCount(0);
  await panel.getByText("Close", { exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(today(page)).not.toContainText("Tuesday Rest and Reflect");
});

test("no check for 10 minutes: a notice above the list, gone when a check succeeds (NT-6)", async ({
  page,
}) => {
  await serve(page, first);
  await page.goto("/");
  await expect(today(page)).toBeVisible();
  const notice = page.locator("main > [role=status]");
  await expect(notice).toHaveText("");
  await serve(page, null);
  await page.clock.setFixedTime(new Date("2026-10-13T12:11:00Z"));
  await comeBack(page);
  await expect(notice).toHaveText(
    "Couldn’t check for changes since 8:00 AM. Before you go, check example.org.",
  );
  await expect(notice.getByRole("link")).toHaveAttribute("href", "https://example.org/");
  await serve(page, first);
  await comeBack(page);
  await expect(notice).toHaveText("");
});
