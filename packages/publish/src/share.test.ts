import { expect, test } from "vitest";
import { eventShare } from "./share.ts";
import { golden, goldenEvent } from "../test/schedule.ts";

// What a shared event says (EV-35), on the golden schedule's events.

const site = golden.snapshot.site;
const text = (title: string, changes = {}) => eventShare(goldenEvent(title, changes), site).text;

test("an evening class: the date, the times once with AM or PM, Eastern, the center", () => {
  expect(eventShare(goldenEvent("Tuesday Rest and Reflect"), site)).toEqual({
    title: "Tuesday Rest and Reflect",
    text: "Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC",
  });
  expect(text("Silent Saturday Retreat - A Heart of Gratitude")).toBe(
    "Sat, Oct 17, 2026 · 10:00 AM – 1:00 PM Eastern · KMC DC",
  );
});

test("elsewhere: the city; online: Online", () => {
  expect(text("Richmond Meditation Class")).toBe(
    "Mon, Oct 12, 2026 · 7:00 – 8:00 PM Eastern · Richmond",
  );
  expect(text("Online: Silent Saturday: A Heart of Gratitude")).toBe(
    "Sat, Oct 17, 2026 · 10:00 AM – 1:00 PM Eastern · Online",
  );
});

test("over several days: from the first day's start to the last day's end", () => {
  expect(text("International Fall Festival")).toBe(
    "Fri, Oct 9, 2026, 7:30 PM – Thu, Oct 15, 2026, 12:00 PM Eastern · Málaga",
  );
});

test("all day, and no end", () => {
  expect(
    text("Center Cherishing", {
      start: "2026-11-08T00:00:00-05:00",
      end: "2026-11-09T00:00:00-05:00",
      allDay: true,
    }),
  ).toBe("Sun, Nov 8, 2026 · All day · KMC DC");
  expect(text("Center Cherishing", { end: null })).toBe(
    "Sun, Nov 8, 2026 · 2:00 PM Eastern · KMC DC",
  );
});

test("no place from the website: when alone", () => {
  expect(text("Center Cherishing", { location: null })).toBe(
    "Sun, Nov 8, 2026 · 2:00 – 5:00 PM Eastern",
  );
});
