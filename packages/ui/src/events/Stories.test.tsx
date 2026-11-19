import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { STORY_MS, Stories, type Story } from "./Stories.tsx";

// The splash as a gallery of featured events (EV-44), option B (owner, 15 November 2026):
// 5 seconds each, then the app; Skip, See all events or a tap shows the app at any time; a
// swipe moves between events; Pause when they run past 5 seconds; Register holds them.

const story = (id: string, title: string): Story => ({
  id,
  title,
  when: "Sun, Nov 29, 2026 · 10:00 – 11:15 AM",
  where: "KMC DC",
  picture: `/v2/feed/pictures/${id}-story.jpg`,
  link: { label: "Register", href: `https://www.example.org/event-details/${id}` },
  kind: "special",
  tag: "Special event",
});
const GUEST_TEACHER = story(
  "guest-teacher",
  "Special Sunday Morning Meditation with Teacher E. Example",
);
const RETREAT = story("retreat", "Sample Retreat");
const LOGO = "/logo.png";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = (stories: Story[], onClose = vi.fn()) => {
  render(<Stories stories={stories} logo={LOGO} onClose={onClose} />);
  return onClose;
};
const swipe = (dx: number) => {
  const el = screen.getByRole("dialog");
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 305 }] });
};

test("one event: its picture whole over a blurred copy, its tag, title, when and where; 5 seconds, then the app", () => {
  expect(STORY_MS).toBe(5000);
  const onClose = show([GUEST_TEACHER]);
  expect(screen.getByRole("dialog", { name: "Featured events" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: GUEST_TEACHER.title })).toBeTruthy();
  expect(screen.getByText("Special event")).toBeTruthy();
  const pictures = document.querySelectorAll(".ui-poster-media img:not(.ui-poster-logo)");
  expect([...pictures].map((p) => p.className)).toEqual(["ui-poster-blur", "ui-poster-pic"]);
  // One event moves for no more than 5 seconds: no Pause, no dots.
  expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  act(() => {
    vi.advanceTimersByTime(STORY_MS - 1);
  });
  expect(onClose).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(onClose).toHaveBeenCalledOnce();
});

test("Skip, See all events or a tap shows the app from the first event", () => {
  for (const leave of [
    () => fireEvent.click(screen.getByRole("button", { name: "Skip" })),
    () => fireEvent.click(screen.getByRole("button", { name: "See all events" })),
    () => fireEvent.click(screen.getByRole("heading", { name: GUEST_TEACHER.title })),
  ]) {
    const onClose = show([GUEST_TEACHER, RETREAT]);
    leave();
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
  }
});

test("a swipe moves between events and starts their 5 seconds again; past the last, the app", () => {
  const onClose = show([GUEST_TEACHER, RETREAT]);
  expect(screen.getByText("1 of 2")).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(STORY_MS - 1000);
  });
  swipe(-120);
  expect(screen.getByRole("heading", { name: RETREAT.title })).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(STORY_MS - 1000);
  });
  expect(onClose).not.toHaveBeenCalled();
  swipe(120);
  expect(screen.getByRole("heading", { name: GUEST_TEACHER.title })).toBeTruthy();
  // A small move is not a swipe.
  swipe(-20);
  expect(screen.getByRole("heading", { name: GUEST_TEACHER.title })).toBeTruthy();
  swipe(-120);
  swipe(-120);
  expect(onClose).toHaveBeenCalledOnce();
});

test("Pause holds them; Register opens the event's page and holds them", () => {
  const onClose = show([GUEST_TEACHER, RETREAT]);
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  act(() => {
    vi.advanceTimersByTime(STORY_MS * 3);
  });
  expect(screen.getByRole("heading", { name: GUEST_TEACHER.title })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  act(() => {
    vi.advanceTimersByTime(STORY_MS);
  });
  const register = screen.getByRole("link", { name: "Register" });
  expect(register.getAttribute("href")).toBe(RETREAT.link.href);
  expect(register.getAttribute("target")).toBe("_blank");
  fireEvent.click(register);
  act(() => {
    vi.advanceTimersByTime(STORY_MS * 3);
  });
  expect(onClose).not.toHaveBeenCalled();
});

test("an event with no picture, or whose picture doesn't load, shows the center's logo", () => {
  show([{ ...GUEST_TEACHER, picture: null }, RETREAT]);
  const defaults = () => [...document.querySelectorAll(".ui-poster-default")];
  expect(defaults().map((d) => d.getAttribute("src"))).toEqual([LOGO]);
  expect(document.querySelectorAll(".ui-poster-pic")).toHaveLength(1);
  const picture = document.querySelector(".ui-poster-pic");
  if (picture) fireEvent.error(picture);
  expect(defaults()).toHaveLength(2);
  expect(document.querySelectorAll(".ui-poster-pic")).toHaveLength(0);
});
