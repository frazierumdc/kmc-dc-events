import { expect, test } from "@playwright/test";
import { belowControls, current, eventsScreen, firstShown, serveFeed } from "./events-support.ts";

// The Events screen: the row of dates and the day it marks (EV-13, EV-14).

eventsScreen();

test("the row of dates starts today in Eastern time; tapping a date moves the list to it (EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  // In Tokyo it's already the 14th; the first date is still Tuesday the 13th.
  await expect(strip.getByRole("button").first()).toHaveAccessibleName(
    "Tuesday, October 13, 2026, 2 events",
  );
  await expect(current(page)).toHaveAccessibleName("Tuesday, October 13, 2026, 2 events");
  const regions = await page.getByRole("region").count();

  await strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" }).click();
  await expect(current(page)).toHaveAccessibleName("Saturday, October 17, 2026, 2 events");
  await expect(page.getByRole("region")).toHaveCount(regions);
  expect(Math.abs(Number(await belowControls(page, "2026-10-17")))).toBeLessThan(1);
  await expect(page.locator("#day-2026-10-17")).toBeFocused();
  await expect(page.getByRole("button", { name: "Show all days" })).toHaveCount(0);

  // A date with nothing on it moves to the next day that has something.
  await strip.getByRole("button", { name: "Friday, October 16, 2026, no events" }).click();
  await expect(current(page)).toHaveAccessibleName("Saturday, October 17, 2026, 2 events");

  // The first date goes back to the top, large title and all.
  await strip.getByRole("button", { name: "Tuesday, October 13, 2026, 2 events" }).click();
  await expect(current(page)).toHaveAccessibleName("Tuesday, October 13, 2026, 2 events");
  expect(await page.evaluate("window.scrollY")).toBe(0);
});

test("scrolling the list moves the marked date, and the row keeps it in view (EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(current(page)).toHaveAccessibleName("Tuesday, October 13, 2026, 2 events");
  // Scroll so Thursday's heading sits just under the controls. Days are drawn at their real
  // height as they come near, which moves it: scroll again until it stays.
  await page.evaluate(`(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0; i < 6; i++) {
      window.scrollBy(0, document.getElementById("day-2026-10-15").parentElement.getBoundingClientRect().top
        - document.querySelector(".ui-controls").getBoundingClientRect().bottom + 5);
      await frame();
    }
  })()`);
  await expect(current(page)).toHaveAccessibleName("Thursday, October 15, 2026, 1 event");
  await page.evaluate("window.scrollTo(0, 0)");
  await expect(current(page)).toHaveAccessibleName("Tuesday, October 13, 2026, 2 events");

  // The last date is off the row's edge; marking it scrolls the row to show it.
  const last = page
    .getByRole("group", { name: "Choose a day" })
    .getByRole("button", { name: "Sunday, November 8, 2026, 1 event" });
  await page.evaluate(`document.querySelector(".ui-strip").scrollLeft = 0`);
  await last.evaluate((b: { click: () => void }) => {
    b.click();
  });
  await expect(current(page)).toHaveAccessibleName("Sunday, November 8, 2026, 1 event");
  await expect(last).toBeInViewport({ ratio: 1 });

  // Marked dates changing every frame (a fast scroll), and a slide the phone cuts short:
  // the row still ends with the last marked date in view.
  await page.evaluate(`new Promise((r) => {
    const dates = [...document.querySelectorAll(".ui-strip button")];
    const order = [dates.length - 1, 0, dates.length - 1, 0, dates.length - 1];
    const step = () => {
      dates[order.shift()].click();
      if (order.length > 0) requestAnimationFrame(step);
      else r();
    };
    requestAnimationFrame(step);
  })`);
  await page.evaluate(`document.querySelector(".ui-strip").scrollLeft = 0`);
  await expect(current(page)).toHaveAccessibleName("Sunday, November 8, 2026, 1 event");
  await expect(last).toBeInViewport({ ratio: 1 });
});

test("the month's name stays at the row's start until the next month's pushes it out (EV-13)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const months = page.locator(".ui-strip .ui-month");
  await expect(months).toHaveText(["Oct 2026", "Nov 2026"]);
  const left = (i: number) =>
    page.evaluate(`(() => {
      const strip = document.querySelector(".ui-strip").getBoundingClientRect().left;
      return document.querySelectorAll(".ui-strip .ui-month")[${String(i)}].getBoundingClientRect().left - strip;
    })()`);
  // Scrolled past the first dates of October: its name stays whole at the row's start.
  await page.evaluate(
    `document.querySelector(".ui-strip").scrollTo({ left: 200, behavior: "instant" })`,
  );
  await expect.poll(() => left(0)).toBe(16);
  await expect(months.first()).toBeInViewport({ ratio: 1 });
  // In November: October's name has gone and November's has taken its place.
  await page.evaluate(
    `document.querySelector(".ui-strip").scrollTo({ left: 1e4, behavior: "instant" })`,
  );
  await expect.poll(() => left(1)).toBe(16);
  expect(Number(await left(0))).toBeLessThan(0);
  // Clear of the marked date's fill below it.
  const gap = await page.evaluate(`(() => {
    const month = document.querySelector(".ui-strip .ui-month").getBoundingClientRect();
    return document.querySelector(".ui-strip .ui-date").getBoundingClientRect().top - month.bottom;
  })()`);
  expect(gap).toBeGreaterThanOrEqual(4);
});

test("changing the filter keeps the date: the marked day is the first one shown, at the top (EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  await strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" }).click();
  await expect.poll(() => firstShown(page)).toBe("2026-10-17");

  // Prayers has nothing on the 17th: its next day is marked and first.
  await page.getByRole("button", { name: "Prayers", exact: true }).click();
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 1 event");
  await expect.poll(() => firstShown(page)).toBe("2026-10-18");

  // Back to All: the 18th stays, now at the top under the row of dates.
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 2 events");
  await expect.poll(() => firstShown(page)).toBe("2026-10-18");
  await expect
    .poll(async () => Math.abs(Number(await belowControls(page, "2026-10-18"))))
    .toBeLessThan(1);
  // Focus stays where it was (Safari doesn't focus a tapped button), not on the heading.
  expect(await page.evaluate("document.activeElement.tagName")).not.toBe("H2");
});

test("a tap on the status bar after a date or filter moved the list marks the first date again (EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  const today = "Tuesday, October 13, 2026, 2 events";
  // iPhone's status bar scrolls the page to the top over a few frames, with no touch on the
  // page; a finger gets there after the few frames the list takes to settle. (WebKit's own
  // smooth scroll here stops short as days come near and are drawn.)
  const statusBarTap = async () => {
    await page.waitForTimeout(300);
    await page.evaluate(`(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 30 && window.scrollY > 0; i++) {
        window.scrollTo({ top: Math.floor(window.scrollY * 0.6), behavior: "instant" });
        await frame();
      }
    })()`);
  };

  await strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" }).click();
  await expect(current(page)).toHaveAccessibleName("Saturday, October 17, 2026, 2 events");
  await statusBarTap();
  await expect(current(page)).toHaveAccessibleName(today);

  // From another filter, back to All: the date kept is held until the list leaves it.
  await page.getByRole("button", { name: "Prayers", exact: true }).click();
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 1 event");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 2 events");
  await expect.poll(() => firstShown(page)).toBe("2026-10-18");
  await statusBarTap();
  await expect.poll(() => page.evaluate("window.scrollY")).toBe(0);
  await expect(current(page)).toHaveAccessibleName(today);
});

test("a tapped date is filled maroon; a new filter slides the fill to the new date (EV-13, EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  const saturday = strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" });
  await saturday.click();
  // The tapped date is filled maroon (EV-13).
  expect(
    await page.evaluate<string>(
      `getComputedStyle(document.querySelector('.ui-date[data-date="2026-10-17"]'), "::before").opacity`,
    ),
  ).toBe("1");
  await page.evaluate(`(() => {
    const strip = document.querySelector(".ui-strip");
    new MutationObserver(() => {
      if ("pill" in strip.dataset) window.slid = true;
    }).observe(strip, { attributes: true });
  })()`);
  await page.getByRole("button", { name: "Prayers", exact: true }).click();
  // The fill starts on the 17th and slides to the 18th.
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 1 event");
  await expect.poll(() => page.evaluate("window.slid === true")).toBe(true);
  await expect(strip).not.toHaveAttribute("data-pill");
  // The fill comes to rest on the new date (a slow machine may still be on its last frame).
  await expect
    .poll(() =>
      page.evaluate(
        `getComputedStyle(document.querySelector('.ui-strip [aria-current="true"]'), "::before").transform`,
      ),
    )
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});
