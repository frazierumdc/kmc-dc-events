import { expect, test } from "@playwright/test";
import { eventsScreen, serveFeed } from "./events-support.ts";

// The Events screen: the details panel and what it opens (EV-36).

eventsScreen();

test("Add to calendar: Apple or Google Calendar on iPhone, Google Calendar on Android", async ({
  page,
}, testInfo) => {
  await serveFeed(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Tuesday Rest and Reflect/ }).click();
  if (testInfo.project.name === "android") {
    const link = page.getByRole("link", { name: "Add to calendar" });
    await expect(link).toHaveAttribute("href", /^https:\/\/calendar\.google\.com\//);
    return;
  }
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to calendar" });
  const apple = sheet.getByRole("link", { name: "Apple Calendar" });
  // The calendar file opens in the app's own window, where iPhone offers to add it.
  await expect(apple).toHaveAttribute("href", /\/v2\/feed\/calendar\/[0-9a-f-]+\.ics$/);
  await expect(apple).not.toHaveAttribute("target", /.*/);
  await expect(sheet.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  // The details panel is still open.
  await expect(page.getByRole("dialog", { name: "Tuesday Rest and Reflect" })).toBeVisible();
});

test("Directions: Apple or Google Maps on iPhone, Google Maps on Android, to the address", async ({
  page,
}, testInfo) => {
  await serveFeed(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Tuesday Rest and Reflect/ }).click();
  const google =
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=1200%20Canal%20St%20SW/;
  if (testInfo.project.name === "android") {
    await expect(page.getByRole("link", { name: "Directions" })).toHaveAttribute("href", google);
    return;
  }
  await page.getByRole("button", { name: "Directions" }).click();
  const sheet = page.getByRole("dialog", { name: "Directions" });
  await expect(sheet.getByRole("link")).toHaveText(["Apple Maps", "Google Maps"]);
  await expect(sheet.getByRole("link", { name: "Apple Maps" })).toHaveAttribute(
    "href",
    /^https:\/\/maps\.apple\.com\/directions\?destination=1200%20Canal%20St%20SW/,
  );
  await expect(sheet.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", google);
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Tuesday Rest and Reflect" })).toBeVisible();
});

test("the details panel slides up into place without a jump (EV-36, #138)", async ({ page }) => {
  await serveFeed(page);
  await page.goto("/");
  await page.getByRole("region", { name: "Today, October 13, 2026" }).waitFor();
  // Every frame of the slide until it has ended, however slow the machine: the panel's top and
  // how far the dialog itself is scrolled; then where it rests. (A fixed window ended mid-slide
  // on a slow machine and took that for the resting place.) 300 frames at most: the clock is
  // fixed, so Date.now() doesn't move.
  const { rest, frames } = await page.evaluate<{
    rest: number;
    frames: { top: number; scrolled: number }[];
  }>(`(async () => {
    document.querySelector("a.ui-row").click();
    const seen = [];
    let panel = null;
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const dialog = document.querySelector(".ui-sheet");
      panel = document.querySelector(".ui-sheet-panel");
      if (!dialog || !panel) continue;
      const sliding = panel.getAnimations().length > 0;
      seen.push({ top: panel.getBoundingClientRect().top, scrolled: dialog.scrollTop });
      if (seen.length > 1 && !sliding) break;
    }
    return { rest: panel ? panel.getBoundingClientRect().top : 0, frames: seen };
  })()`);
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.every((f) => f.scrolled === 0)).toBe(true);
  // It comes up from below and never passes the place where it stops.
  expect(Math.min(...frames.map((f) => f.top))).toBeGreaterThanOrEqual(rest - 1);
});

test("dragging the panel down closes it, sliding on from where the finger let go (EV-36)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Tuesday Rest and Reflect/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Until the panel has finished sliding up.
  await page.evaluate(
    `Promise.all(document.querySelector(".ui-sheet-panel").getAnimations().map((a) => a.finished))`,
  );

  // A finger on the grabber moving 220 px down over six frames, then lifted; every frame's
  // panel top, from the touch until the panel has gone.
  const frames = await page.evaluate<{ rest: number; tops: number[] }>(`(async () => {
    const panel = document.querySelector(".ui-sheet-panel");
    const target = panel.querySelector(".ui-grabber");
    const rest = panel.getBoundingClientRect().top;
    const send = (type, y) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = y === null ? [] : [{ clientX: 200, clientY: y, target }];
      Object.defineProperty(event, "touches", { value: touches });
      target.dispatchEvent(event);
    };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const y0 = rest + 8;
    send("touchstart", y0);
    for (let i = 1; i <= 6; i++) {
      await frame();
      send("touchmove", y0 + (220 * i) / 6);
    }
    await frame();
    send("touchend", null);
    // Only while the dialog is open: once closed, the panel is hidden (drawn nowhere, top 0)
    // until it is removed on the next render.
    const tops = [];
    for (;;) {
      const open = document.querySelector(".ui-sheet[open] .ui-sheet-panel");
      if (!open) break;
      tops.push(open.getBoundingClientRect().top);
      await frame();
    }
    return { rest, tops };
  })()`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  // It never comes back up past where the finger left it.
  expect(Math.min(...frames.tops)).toBeGreaterThanOrEqual(frames.rest + 219);
});
