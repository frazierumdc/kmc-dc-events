import { expect, test } from "@playwright/test";
import {
  current,
  eventsScreen,
  firstShown,
  labels,
  serveFeed,
  swipe,
  thumbOff,
} from "./events-support.ts";

// The Events screen: the kind filter, tapped and swiped (EV-12).

eventsScreen();

test("the filter: each choice the phone's own target size, every name whole, on a narrow phone at twice the text (EV-12)", async ({
  page,
}, testInfo) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  // Option A (owner, 13 November 2026): 44 pt on iPhone (Apple), 48 dp on Android (Material).
  const target = testInfo.project.name === "android" ? 48 : 44;
  const sizes = () =>
    page.evaluate<{ height: number; cut: boolean; radius: string }[]>(`(() =>
      [...document.querySelectorAll(".ui-filter button")].map((b) => ({
        height: Math.round(b.getBoundingClientRect().height),
        cut: b.scrollWidth > b.clientWidth,
        radius: getComputedStyle(b.parentElement).borderTopLeftRadius,
      })))()`);
  for (const size of await sizes()) {
    expect(size.height).toBeGreaterThanOrEqual(target);
    expect(size.cut).toBe(false);
    expect(size.radius).toBe("999px");
  }
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addStyleTag({ content: "html { font-size: 212.5% !important; }" });
  for (const size of await sizes()) expect(size.cut).toBe(false);
});

test("swiping the list sideways moves through the filters and stops at the ends (EV-12)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  const selected = page.locator('.ui-filter button[aria-pressed="true"]');
  const left = async () => {
    await swipe(page, [300, 500], [140, 510]);
  };
  const right = async () => {
    await swipe(page, [140, 500], [300, 510]);
  };

  // Left to right on All, the first filter: it springs back.
  await right();
  await page.waitForTimeout(300);
  await expect(selected).toHaveText("All");
  await left();
  await expect(selected).toHaveText("Classes");
  await left();
  await expect(selected).toHaveText("Special");
  await left();
  await expect(selected).toHaveText("Prayers");
  await left();
  await page.waitForTimeout(300);
  await expect(selected).toHaveText("Prayers");
  await expect(page.getByRole("region")).toHaveCount(1);
  await right();
  await expect(selected).toHaveText("Special");
  // The swipe opened nothing, and the list is back in place.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".ui-swipe")).toHaveCSS("opacity", "1");

  // Mostly up and down is a scroll, not a swipe; one from the screen's edge is the phone's.
  await swipe(page, [300, 500], [250, 300]);
  await swipe(page, [5, 500], [200, 500]);
  await page.waitForTimeout(300);
  await expect(selected).toHaveText("Special");
});

test("the kind filter keeps every day it matches; tapping a date moves to its next match (EV-12, EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  const day = page.getByRole("region", { name: "Today, October 13, 2026" });
  await page.getByRole("button", { name: "Classes", exact: true }).click();
  await expect(labels(day)).toHaveText([
    "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC",
  ]);
  await page.getByRole("button", { name: "Special", exact: true }).click();
  await expect(labels(day)).toHaveText([
    "All day, International Fall Festival, Special, Day 5 of 7, in Málaga",
  ]);
  await page.getByRole("button", { name: "Prayers", exact: true }).click();
  await expect(page.getByRole("region")).toHaveCount(1);
  await strip.getByRole("button", { name: "Tuesday, October 13, 2026, no events" }).click();
  await expect(current(page)).toHaveAccessibleName("Sunday, October 18, 2026, 1 event");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(labels(day)).toHaveCount(2);
});

test("the filter's selection follows a swipe; letting go short slides it back (EV-12)", async ({
  page,
}, testInfo) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  const root = page.locator("html");
  // Halfway to Classes, finger still down: the list and the selection have moved with it.
  await swipe(page, [300, 500], [220, 505], false);
  const toward = Number(
    await page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue("--swipe")`),
  );
  expect(toward).toBeGreaterThan(0.3);
  expect(toward).toBeLessThan(1);
  await expect(root).toHaveAttribute("data-swipe-to", "next");
  if (testInfo.project.name === "android") {
    // The button letting go would choose is tinted already; the selected one isn't.
    await expect(page.getByRole("button", { name: "Classes", exact: true })).toHaveCSS(
      "color",
      "rgb(122, 31, 43)",
    );
  } else {
    expect(Number(await thumbOff(page))).toBeGreaterThan(20);
  }
  // Back toward the start and let go: nothing changes and everything returns.
  await swipe(page, [220, 505], [290, 505]);
  await expect(page.locator('.ui-filter [aria-pressed="true"]')).toHaveText("All");
  await expect(root).not.toHaveAttribute("data-swiping");
  await expect(root).not.toHaveAttribute("data-swipe-to");
  await expect.poll(() => thumbOff(page)).toBeLessThan(1);
  await expect(page.locator(".ui-swipe")).toHaveAttribute("style", /transform: ;|^(?!.*translate)/);

  // A tap slides the thumb to the segment; a swipe leaves it there too.
  await page.getByRole("button", { name: "Special", exact: true }).click();
  await expect.poll(() => thumbOff(page)).toBeLessThan(1);
  await swipe(page, [300, 500], [140, 505]);
  await expect(page.locator('.ui-filter [aria-pressed="true"]')).toHaveText("Prayers");
  await expect.poll(() => thumbOff(page)).toBeLessThan(1);
  await expect(page.locator(".ui-swipe")).toHaveCSS("opacity", "1");
});

test("a swipe holds the list and its date still; the next list comes in once drawn, the page never wider than the screen and the bars blurred again as it shows (EV-12, EV-14)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  await strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" }).click();
  await expect.poll(() => firstShown(page)).toBe("2026-10-17");
  const top = Number(await page.evaluate("window.scrollY"));
  // Each frame from here: the selected filter, the list's opacity, whether the list is
  // changing, how many days are drawn at once, and how much wider than the screen the page is
  // (iPhone zooms the whole page out to fit a wider one).
  await page.evaluate(`(() => {
    window.frames_ = [];
    const log = () => {
      window.frames_.push({
        on: document.querySelector('.ui-filter [aria-pressed="true"]').textContent,
        opacity: Number(getComputedStyle(document.querySelector(".ui-swipe")).opacity),
        switching: "switching" in document.documentElement.dataset,
        near: document.querySelectorAll(".ui-day[data-near]").length,
        wide: document.documentElement.scrollWidth - innerWidth,
      });
      requestAnimationFrame(log);
    };
    requestAnimationFrame(log);
  })()`);
  // The page drifts up before the swipe is told from a scroll, then the finger goes left.
  await page.evaluate(`(async () => {
    const target = document.querySelector(".ui-swipe");
    const send = (type, p) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", {
        value: p === null ? [] : [{ clientX: p[0], clientY: p[1], target }],
      });
      target.dispatchEvent(event);
    };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    send("touchstart", [300, 500]);
    window.scrollBy(0, -120);
    await frame();
    await frame();
    for (let i = 1; i <= 6; i++) {
      await frame();
      send("touchmove", [300 - 25 * i, 502]);
    }
  })()`);
  // Finger still down: the list is back where it was and the 17th is still marked.
  expect(Number(await page.evaluate("window.scrollY"))).toBe(top);
  await expect(current(page)).toHaveAccessibleName("Saturday, October 17, 2026, 2 events");
  await page.evaluate(`(() => {
    const target = document.querySelector(".ui-swipe");
    const event = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [] });
    target.dispatchEvent(event);
  })()`);
  await expect(page.locator('.ui-filter [aria-pressed="true"]')).toHaveText("Classes");
  await expect(page.locator("html")).not.toHaveAttribute("data-switching");
  await expect(page.locator(".ui-swipe")).toHaveCSS("opacity", "1");
  // Classes keeps the date: its day from the 17th is marked and at the top.
  const marked = (await current(page).getAttribute("data-date")) ?? "";
  expect(marked >= "2026-10-17").toBe(true);
  await expect.poll(() => firstShown(page)).toBe(marked);
  await expect.poll(() => page.locator(".ui-day[data-near]").count()).toBe(0);

  // The new list stayed hidden, its first days drawn, for frames before coming in.
  const frames =
    await page.evaluate<
      { on: string; opacity: number; switching: boolean; near: number; wide: number }[]
    >("window.frames_");
  const changed = frames.findIndex((f) => f.on.includes("Classes"));
  const shown = frames.findIndex((f, i) => i >= changed && f.opacity > 0);
  expect(changed).toBeGreaterThan(-1);
  expect(shown - changed).toBeGreaterThanOrEqual(2);
  expect(frames[changed]).toMatchObject({ opacity: 0, switching: true });
  expect(frames[changed]?.near).toBeGreaterThan(0);
  // The bars blur the list again from the first frame it shows, not once it has settled.
  expect(frames.slice(shown).filter((f) => f.switching)).toEqual([]);
  // Coming in from the side, the list never makes the page wider than the screen.
  expect(frames.filter((f) => f.wide > 0)).toEqual([]);
});

test("the selected iPhone segment is semibold; dark mode's thumb is lighter than the control (EV-12)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "android", "Android has connected buttons, not a thumb");
  await page.emulateMedia({ colorScheme: "dark" });
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveCSS(
    "font-weight",
    "600",
  );
  await expect(page.getByRole("button", { name: "Classes", exact: true })).toHaveCSS(
    "font-weight",
    "500",
  );
  await expect(page.locator(".ui-thumb")).toHaveCSS("background-color", "rgb(83, 83, 86)");
});

test("a tapped filter is selected at once and the list slides to it, as a swipe does, the page never wider than the screen (EV-12)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  // Each frame: the list's sideways offset and opacity, and which filter it lists.
  await page.evaluate(`(() => {
    window.frames_ = [];
    const log = () => {
      const list = document.querySelector(".ui-swipe");
      window.frames_.push({
        x: new DOMMatrix(getComputedStyle(list).transform).m41,
        opacity: Number(getComputedStyle(list).opacity),
        prayersOnly: document.querySelectorAll(".ui-row:not([data-kind=prayer])").length === 0,
        wide: document.documentElement.scrollWidth - innerWidth,
      });
      requestAnimationFrame(log);
    };
    requestAnimationFrame(log);
  })()`);
  const prayers = page.getByRole("button", { name: "Prayers", exact: true });
  await prayers.click();
  // Selected before the list has changed.
  expect(await prayers.getAttribute("aria-pressed")).toBe("true");
  await expect.poll(() => page.evaluate("window.frames_.at(-1).prayersOnly")).toBe(true);
  await expect(page.locator(".ui-swipe")).toHaveCSS("opacity", "1");
  const frames =
    await page.evaluate<{ x: number; opacity: number; prayersOnly: boolean; wide: number }[]>(
      "window.frames_",
    );
  const changed = frames.findIndex((f) => f.prayersOnly);
  // Out to the left, fading, then in from the right: a later filter, one short slide.
  expect(frames.slice(0, changed).some((f) => f.x < -20 && f.opacity < 1)).toBe(true);
  expect(frames.slice(changed).some((f) => f.x > 10)).toBe(true);
  await expect(page.locator(".ui-swipe")).not.toHaveAttribute("style", /translate/);

  // Back to All: out to the right, in from the left.
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect.poll(() => page.evaluate("window.frames_.at(-1).prayersOnly")).toBe(false);
  await expect(page.locator(".ui-swipe")).not.toHaveAttribute("style", /translate|opacity/);
  const back = await page.evaluate<{ x: number; wide: number }[]>("window.frames_");
  expect(back.some((f) => f.x > 20)).toBe(true);
  // Either way, the list sliding past the edge never makes the page wider than the screen
  // (iPhone would zoom the whole page out to fit it).
  expect(back.filter((f) => f.wide > 0)).toEqual([]);
});

test("nothing flashes or darkens: a tapped date's day, a row pressed or closed (EV-14, EV-36)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Choose a day" });
  await strip.getByRole("button", { name: "Saturday, October 17, 2026, 2 events" }).click();
  const heading = page.locator("#day-2026-10-17");
  await expect(heading).toBeFocused();
  await expect(heading).not.toHaveAttribute("data-flash");
  expect(
    await page.evaluate(
      `getComputedStyle(document.getElementById("day-2026-10-17"), "::before").animationName`,
    ),
  ).toBe("none");

  const row = page.getByRole("link", { name: /Tuesday Rest and Reflect/ });
  const look = `getComputedStyle([...document.querySelectorAll("a.ui-row")].find((a) =>
    a.textContent.includes("Tuesday Rest and Reflect"))).backgroundImage`;
  const resting = await page.evaluate<string>(look);
  await row.dispatchEvent("pointerdown", { button: 0, clientX: 100, clientY: 400 });
  await expect(row.locator(".ui-ripple")).toHaveCount(0);
  await row.hover();
  await page.mouse.down();
  expect(await page.evaluate<string>(look)).toBe(resting);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect(row).not.toHaveAttribute("data-flash");
  expect(
    await page.evaluate(`getComputedStyle(document.activeElement, "::after").animationName`),
  ).toBe("none");
});

test("with Reduce Motion a swipe changes the filter without sliding (EV-12)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  await swipe(page, [300, 500], [140, 505]);
  await expect(page.locator('.ui-filter [aria-pressed="true"]')).toHaveText("Classes");
  expect(await page.evaluate(`document.querySelector(".ui-swipe").style.transform`)).toBe("");
  expect(Number(await thumbOff(page))).toBeLessThan(1);
});

test("a swipe the moment the list appears is not missed (EV-12)", async ({ page }) => {
  // Swipes as the list is put on the page, before it is drawn: the swipe must already work.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(`new MutationObserver((_, watch) => {
    const target = document.querySelector(".ui-swipe");
    if (!target) return;
    watch.disconnect();
    const send = (type, p) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = p === null ? [] : [{ clientX: p[0], clientY: p[1], target }];
      Object.defineProperty(event, "touches", { value: touches });
      target.dispatchEvent(event);
    };
    send("touchstart", [300, 500]);
    for (let i = 1; i <= 6; i++) send("touchmove", [300 - (160 * i) / 6, 500]);
    send("touchend", null);
  }).observe(document, { childList: true, subtree: true })`);
  await serveFeed(page);
  await page.goto("/");
  await expect(page.getByRole("region").first()).toBeVisible();
  await expect(page.locator('.ui-filter [aria-pressed="true"]')).toHaveText("Classes");
});
