import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AWAY_MS, SPLASH_MS, startSplash } from "./splash.ts";

// The splash (EV-42): 3 seconds from the start, longer until the schedule shows, again after
// 5 minutes away, never for a shared event's link.

let doc: Document;
let wallClock = 0;

beforeEach(() => {
  vi.useFakeTimers();
  doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = '<div id="splash"></div><div id="root"></div>';
  wallClock = 1_000_000;
});

afterEach(() => {
  vi.useRealTimers();
});

const splashEl = () => doc.getElementById("splash") as HTMLElement;
const root = () => doc.getElementById("root") as HTMLElement;
/** Shows, and isn't fading away. */
const showing = () => !splashEl().hidden && !splashEl().classList.contains("splash-out");

function start(sinceStart = 0) {
  return startSplash({ doc, clock: () => wallClock, sinceStart: () => sinceStart });
}

function leaveFor(ms: number) {
  Object.defineProperty(doc, "visibilityState", { value: "hidden", configurable: true });
  doc.dispatchEvent(new Event("visibilitychange"));
  wallClock += ms;
  Object.defineProperty(doc, "visibilityState", { value: "visible", configurable: true });
  doc.dispatchEvent(new Event("visibilitychange"));
}

test("shows for 3 seconds from the start, then fades and hides", () => {
  const splash = start();
  splash.ready();
  expect(showing()).toBe(true);
  expect(root().inert).toBe(true);
  vi.advanceTimersByTime(SPLASH_MS - 1);
  expect(showing()).toBe(true);
  vi.advanceTimersByTime(1);
  expect(showing()).toBe(false);
  expect(root().inert).toBe(false);
  vi.advanceTimersByTime(400);
  expect(splashEl().hidden).toBe(true);
});

test("the 3 seconds count from the app's start, not from the script", () => {
  start(1_000).ready();
  vi.advanceTimersByTime(SPLASH_MS - 1_000);
  expect(showing()).toBe(false);
});

test("stays past 3 seconds until the schedule shows", () => {
  const splash = start();
  vi.advanceTimersByTime(10_000);
  expect(showing()).toBe(true);
  splash.ready();
  expect(showing()).toBe(false);
});

test("a tap takes it away once the schedule shows", () => {
  const splash = start();
  splashEl().click();
  expect(showing()).toBe(true);
  splash.ready();
  expect(showing()).toBe(false);
});

test("comes back for 3 seconds after 5 minutes away, not after less", () => {
  start().ready();
  vi.advanceTimersByTime(SPLASH_MS + 400);
  leaveFor(AWAY_MS - 1);
  expect(showing()).toBe(false);
  leaveFor(AWAY_MS);
  expect(showing()).toBe(true);
  vi.advanceTimersByTime(SPLASH_MS);
  expect(showing()).toBe(false);
});

test("a shared event's link opens with no splash; later returns show it", () => {
  doc.documentElement.dataset.nosplash = "link";
  start().ready();
  expect(splashEl().hidden).toBe(true);
  expect(root().inert).not.toBe(true);
  expect(doc.documentElement.dataset.nosplash).toBeUndefined();
  leaveFor(AWAY_MS);
  expect(showing()).toBe(true);
});

test("switched off (the browser tests), it never shows", () => {
  doc.documentElement.dataset.nosplash = "off";
  start().ready();
  leaveFor(AWAY_MS);
  expect(splashEl().hidden).toBe(true);
});

test("featured events follow the splash once its 3 seconds are up, on opening and after 5 minutes away (EV-44)", () => {
  const splash = start();
  let covers = 0;
  let shown = 0;
  splash.onCover(() => covers++);
  expect(splash.covering()).toBe(true);
  splash.handOff(() => shown++);
  vi.advanceTimersByTime(SPLASH_MS - 1);
  expect(showing()).toBe(true);
  expect(shown).toBe(0);
  vi.advanceTimersByTime(1);
  expect(showing()).toBe(false);
  expect(shown).toBe(1);
  expect(root().inert).toBe(false);
  leaveFor(AWAY_MS);
  expect(covers).toBe(1);
  splash.handOff(() => shown++);
  // A tap takes the splash away at once, and they follow.
  splashEl().click();
  expect(shown).toBe(2);
  leaveFor(60_000);
  expect(covers).toBe(1);
  // With no splash showing, they show at once.
  splash.handOff(() => shown++);
  expect(shown).toBe(3);
});
