import { expect, test } from "vitest";
import { pictureContent, picturePath } from "./share-picture.ts";
import { golden, goldenEvent } from "../test/schedule.ts";

// What an event's share picture shows (EV-35), on the golden schedule's events.

const site = golden.snapshot.site;
const content = (title: string, changes = {}) => pictureContent(goldenEvent(title, changes), site);

test("an evening class: the calendar page, the kind, the name, the time, the center", () => {
  expect(content("Tuesday Rest and Reflect")).toEqual({
    kind: "class",
    kindName: "Class",
    month: "OCT 2026",
    day: "13",
    weekday: "Tuesday",
    title: "Tuesday Rest and Reflect",
    time: "6:00 – 6:30 PM Eastern",
    place: { name: "KMC DC", online: false },
  });
  expect(content("Silent Saturday Retreat - A Heart of Gratitude")).toMatchObject({
    kindName: "Special event",
    time: "10:00 AM – 1:00 PM Eastern",
  });
  expect(content("Wishfulfilling Jewel with Tsog").kindName).toBe("Prayers");
});

test("over several days: the first and last day, and the time with their weekdays", () => {
  expect(content("International Fall Festival")).toMatchObject({
    month: "OCT 2026",
    day: "9–15",
    weekday: "Fri – Thu",
    time: "Fri 7:30 PM – Thu 12:00 PM Eastern",
    place: { name: "Málaga", online: false },
  });
  expect(
    content("International Fall Festival", {
      start: "2026-10-30T19:30:00-04:00",
      end: "2026-11-02T12:00:00-05:00",
    }),
  ).toMatchObject({ month: "OCT – NOV 2026", day: "30–2" });
  expect(
    content("International Fall Festival", {
      start: "2026-12-30T19:30:00-05:00",
      end: "2027-01-02T12:00:00-05:00",
    }).month,
  ).toBe("DEC 2026 – JAN 2027");
});

test("elsewhere, online, no place, no kind", () => {
  expect(content("Richmond Meditation Class").place).toEqual({ name: "Richmond", online: false });
  expect(content("Online: Silent Saturday: A Heart of Gratitude").place).toEqual({
    name: "Online",
    online: true,
  });
  expect(content("Center Cherishing", { location: null }).place).toBeNull();
  expect(content("Center Cherishing")).toMatchObject({ kind: null, kindName: null });
});

test("all day, and no end", () => {
  expect(
    content("Center Cherishing", {
      start: "2026-11-08T00:00:00-05:00",
      end: "2026-11-09T00:00:00-05:00",
      allDay: true,
    }),
  ).toMatchObject({ day: "8", weekday: "Sunday", time: "All day" });
  expect(content("Center Cherishing", { end: null }).time).toBe("2:00 PM Eastern");
});

test("the picture sits beside the event's own page", () => {
  expect(picturePath("abc")).toBe("/e/abc/share.png");
});
