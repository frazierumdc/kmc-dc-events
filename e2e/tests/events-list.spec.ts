import { expect, test } from "@playwright/test";
import {
  belowControls,
  current,
  eventsScreen,
  golden,
  labels,
  serveFeed,
} from "./events-support.ts";

// The Events screen: the list, its look, and what it shows when the schedule is broken.

eventsScreen();

test("lists upcoming events by Eastern date", async ({ page }) => {
  await serveFeed(page);
  await page.goto("/");
  const today = page.getByRole("region", { name: "Today, October 13, 2026" });
  await expect(labels(today)).toHaveText([
    "All day, International Fall Festival, Special, Day 5 of 7, in Málaga",
    "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC",
  ]);
  // Each event is a block tinted with its kind's colour, with a bar of it (D45): red-orange
  // for the festival, then emerald for the class.
  const rows = today.locator(".ui-row");
  // Light mode's stronger block tints and darker bars (D45, owner, 9 November 2026).
  await expect(rows.first()).toHaveCSS("background-color", "rgb(243, 210, 202)");
  await expect(rows.first().locator(".ui-kindbar")).toHaveCSS(
    "background-color",
    "rgb(199, 49, 14)",
  );
  await expect(rows.nth(1).locator(".ui-kindbar")).toHaveCSS(
    "background-color",
    "rgb(0, 131, 110)",
  );
  await expect(labels(page.getByRole("region", { name: "Thursday, October 15, 2026" }))).toHaveText(
    ["All day, International Fall Festival, Special, Day 7 of 7, in Málaga"],
  );
  await expect(labels(page.getByRole("region", { name: "Saturday, October 17, 2026" }))).toHaveText(
    [
      "10:00 AM, Online: Silent Saturday: A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, Online",
      "10:00 AM, Silent Saturday Retreat - A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, at KMC DC",
    ],
  );
  await expect(page.getByText("Richmond Meditation Class")).toHaveCount(0);
  // When the schedule was updated is in Settings, not at the end of the list (EV-17, EV-41).
  await expect(page.getByText("Schedule updated October 9, 2026, 11:00 AM")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Schedule updated October 9, 2026, 11:00 AM")).toBeVisible();
});

test("the kind filter narrows the list and is remembered", async ({ page }) => {
  await serveFeed(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Prayers", exact: true }).click();
  await expect(page.getByRole("region")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Prayers", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("region", { name: "Sunday, October 18, 2026" })).toBeVisible();
});

test("a festival shows only the online icon in the list; its panel has no online button (D46, EV-40)", async ({
  page,
}) => {
  const snapshot = JSON.parse(golden("snapshot-v2.json")) as {
    events: { title: string; online: unknown }[];
  };
  for (const e of snapshot.events)
    if (e.title === "International Fall Festival") e.online = { type: "iconOnly" };
  await serveFeed(page, JSON.stringify(snapshot));
  await page.goto("/");
  const today = page.getByRole("region", { name: "Today, October 13, 2026" });
  await expect(labels(today).first()).toHaveText(
    "All day, International Fall Festival, Special, Day 5 of 7, in Málaga, also online",
  );
  await expect(today.locator(".ui-row").first().locator(".ui-where")).toHaveText("MálagaOnline");
  await today.getByRole("link", { name: /International Fall Festival/ }).click();
  const panel = page.getByRole("dialog", { name: "International Fall Festival" });
  await expect(panel.getByRole("link", { name: "More info", exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: /online|in person/i })).toHaveCount(0);
});

test("iPhone and Android each get their own look", async ({ page }, testInfo) => {
  await serveFeed(page);
  await page.goto("/");
  const platform = testInfo.project.name === "android" ? "android" : "ios";
  await expect(page.locator("html")).toHaveAttribute("data-platform", platform);
  // Each row a card, rounder on iPhone (EV-11).
  await expect(page.locator(".ui-row").first()).toHaveCSS(
    "border-radius",
    platform === "android" ? "16px" : "18px",
  );
});

test("a broken schedule shows an error with Try again", async ({ page }) => {
  await serveFeed(page, "{");
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The schedule isn't valid.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("the top bar always shows Events with the center's name under it, never a large title; the filter and the row of dates stay (EV-22)", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  const bar = page.locator(".ui-topbar");
  await expect(page.getByRole("region", { name: "Today, October 13, 2026" })).toBeVisible();
  const small = bar.locator(".ui-compact-title");
  const title = page.getByRole("heading", { level: 1, name: "Events" });
  await expect(page.locator(".ui-largetitle")).toHaveCount(0);
  const height = (await bar.boundingBox())?.height;
  for (const y of [0, 600, 0]) {
    await page.evaluate(`window.scrollTo(0, ${String(y)})`);
    await expect(title).toBeInViewport();
    await expect(small).toHaveText("EventsKadampa Meditation Center DC");
    await expect(small).toHaveCSS("opacity", "1");
    expect((await bar.boundingBox())?.height).toBe(height);
    await expect(page.getByRole("group", { name: "Show" })).toBeInViewport();
    await expect(page.getByRole("group", { name: "Choose a day" })).toBeInViewport();
  }
  await expect(page.getByRole("button", { name: "Refresh schedule" })).toHaveCount(0);
  // The page doesn't bounce past its top or end (the real bounce shows only on a phone).
  await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "none");
});

test("twice the text size fits the screen and the end of the list clears the bottom; no tab bar", async ({
  page,
}) => {
  await serveFeed(page);
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 212.5% !important; }" });
  await expect(page.getByRole("region").first()).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth - innerWidth")).toBe(0);
  // Days are drawn at their real height as they come near: scroll to the end once they are.
  await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
  await page.evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
  const end = await page.locator("main footer").last().boundingBox();
  const height = await page.evaluate("innerHeight");
  expect(end && end.y + end.height).toBeLessThanOrEqual(Number(height));
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

// A notification opens the list at the event's date, not the event (NT-15): the address
// `/?day=…` puts that day at the top under All, opens no panel, and is then the list's own.
test("an address with a date opens the list at that date, with no panel (NT-15)", async ({
  page,
}) => {
  await serveFeed(page);
  // A remembered filter doesn't hide the date's events on this visit, and stays remembered.
  await page.addInitScript(() => {
    localStorage.setItem("kmcdc.kindFilter", "prayer");
  });
  await page.goto("/?day=2026-10-17");
  await expect(current(page)).toHaveAccessibleName("Saturday, October 17, 2026, 2 events");
  await expect
    .poll(async () => Math.abs(Number(await belowControls(page, "2026-10-17"))))
    .toBeLessThan(1);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kmcdc.kindFilter"))).toBe("prayer");
});
