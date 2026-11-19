import { readFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";

// What the Events screen's specs share (events-*.spec.ts): the golden schema 2 files, the
// fixed clock and time zone, and the helpers that read or move the list.
export const golden = (name: string) =>
  readFileSync(new URL(`../../packages/domain/golden/${name}`, import.meta.url), "utf8");
const manifest = golden("manifest-v2.json");
const snapshotPath = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];

/**
 * Each spec's set-up: the browser clock fixed, and the browser in another time zone, so
 * dates come out in Eastern time. Call it once at the top of a spec file.
 */
export function eventsScreen(): void {
  // In Tokyo, 6 PM Eastern on the 13th is already 7 AM on the 14th.
  test.use({ timezoneId: "Asia/Tokyo" });
  test.beforeEach(async ({ page }) => {
    // Tuesday 13 October 2026, 8 AM Eastern (9 PM in Tokyo).
    await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
  });
}

export async function serveFeed(page: Page, snapshot = golden("snapshot-v2.json")) {
  await page.route("**/v2/feed/manifest.json", (route) => route.fulfill({ body: manifest }));
  await page.route(`**${snapshotPath}`, (route) => route.fulfill({ body: snapshot }));
}

export const labels = (region: ReturnType<Page["getByRole"]>) => region.locator("li .ui-sr");

export const current = (page: Page) =>
  page.getByRole("group", { name: "Choose a day" }).locator('[aria-current="true"]');

/** How far a day's section starts below the controls that stay on screen. */
export const belowControls = (page: Page, date: string) =>
  page.evaluate(`document.getElementById("day-${date}").parentElement.getBoundingClientRect().top
    - document.querySelector(".ui-controls").getBoundingClientRect().bottom`);

/** The date of the first day with anything showing below the controls. */
export const firstShown = (page: Page) =>
  page.evaluate(`(() => {
    const line = document.querySelector(".ui-controls").getBoundingClientRect().bottom + 2;
    const day = [...document.querySelectorAll(".ui-day")].find((d) => d.getBoundingClientRect().bottom > line);
    return day.querySelector("h2").id.slice(4);
  })()`);

/** A finger on the list moving from one point to another, as plain touch events. */
export const swipe = (page: Page, from: [number, number], to: [number, number], lift = true) =>
  page.evaluate(`(async () => {
    const target = document.querySelector(".ui-swipe");
    const send = (type, p) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = p === null ? [] : [{ clientX: p[0], clientY: p[1], target }];
      Object.defineProperty(event, "touches", { value: touches });
      target.dispatchEvent(event);
    };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const [x0, y0] = ${JSON.stringify(from)};
    const [x1, y1] = ${JSON.stringify(to)};
    send("touchstart", [x0, y0]);
    for (let i = 1; i <= 6; i++) {
      await frame();
      send("touchmove", [x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6]);
    }
    if (${String(lift)}) send("touchend", null);
  })()`);

/** How far the iPhone thumb is from the selected segment, in px; 0 on Android (no thumb). */
export const thumbOff = (page: Page) =>
  page.evaluate(`(() => {
    if (document.documentElement.dataset.platform === "android") return 0;
    const thumb = document.querySelector(".ui-thumb").getBoundingClientRect();
    const on = document.querySelector('.ui-filter [aria-pressed="true"]').getBoundingClientRect();
    return Math.abs(thumb.left - on.left);
  })()`);
