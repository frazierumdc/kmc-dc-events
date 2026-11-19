import { expect, test } from "vitest";
import type { WixEvent } from "./wix-event.ts";
import {
  eventCategories,
  eventLocation,
  eventPage,
  eventPicture,
  eventTimes,
  timeZoneWarning,
  whyNotListed,
} from "./wix-adapter.ts";

// The adapter's field mappers, one table each. The adapter as a whole, on real events, is in
// wix-adapter.test.ts.

const listed: WixEvent = {
  id: "a",
  status: "UPCOMING",
  publishedDate: "2026-10-01T12:00:00Z",
  dateAndTimeSettings: { startDate: "2026-10-13T22:00:00Z" },
};

test.each<[string, Partial<WixEvent>, string, string | null]>([
  ["upcoming, published, dated", {}, "Class", null],
  ["started", { status: "STARTED" }, "Class", null],
  ["no status at all", { status: undefined }, "Class", null],
  ["no title", {}, "", "no title"],
  ["ended", { status: "ENDED" }, "Class", "status ENDED"],
  ["cancelled", { status: "CANCELED" }, "Class", "status CANCELED"],
  ["a draft", { publishedDate: undefined }, "Class", "not published"],
  ["no date settings", { dateAndTimeSettings: undefined }, "Class", "date to be decided"],
  ["no start", { dateAndTimeSettings: {} }, "Class", "date to be decided"],
  [
    "date to be decided",
    { dateAndTimeSettings: { startDate: "2026-10-13T22:00:00Z", dateAndTimeTbd: true } },
    "Class",
    "date to be decided",
  ],
  ["no title comes before the status", { status: "ENDED" }, "", "no title"],
  [
    "the status comes before the draft",
    { status: "ENDED", publishedDate: undefined },
    "Class",
    "status ENDED",
  ],
])("whyNotListed: %s", (_name, changes, title, reason) => {
  expect(whyNotListed({ ...listed, ...changes }, title)).toBe(reason);
});

test.each<[string | undefined, string | null]>([
  [undefined, null],
  ["", null],
  ["America/New_York", null],
  ["America/Chicago", "time zone America/Chicago; times are shown in Eastern"],
])("timeZoneWarning: %s", (zone, warning) => {
  expect(timeZoneWarning(zone)).toBe(warning);
});

test.each<[string, WixEvent["eventPageUrl"], string | null]>([
  [
    "base and path",
    { base: "https://www.example.org", path: "/event-details/a" },
    "https://www.example.org/event-details/a",
  ],
  [
    "slashes ending the base",
    { base: "https://www.example.org//", path: "/e/a" },
    "https://www.example.org/e/a",
  ],
  ["no path", { base: "https://www.example.org" }, null],
  ["no base", { path: "/e/a" }, null],
  ["an empty path", { base: "https://www.example.org", path: "" }, null],
  ["nothing", undefined, null],
])("eventPage: %s", (_name, url, page) => {
  expect(eventPage(url)).toBe(page);
});

test.each<[string, string, string | undefined, { start: string; end: string | null }]>([
  [
    "whole seconds, UTC",
    "2026-10-07T23:00:00.773Z",
    "2026-10-08T00:30:00.120Z",
    { start: "2026-10-07T23:00:00Z", end: "2026-10-08T00:30:00Z" },
  ],
  [
    "an offset becomes UTC",
    "2026-10-07T19:00:00-04:00",
    undefined,
    { start: "2026-10-07T23:00:00Z", end: null },
  ],
  [
    "an end equal to the start is no end",
    "2026-10-07T23:00:00Z",
    "2026-10-07T23:00:00.500Z",
    { start: "2026-10-07T23:00:00Z", end: null },
  ],
  [
    "an empty end is no end",
    "2026-10-07T23:00:00Z",
    "",
    { start: "2026-10-07T23:00:00Z", end: null },
  ],
])("eventTimes: %s", (_name, start, end, times) => {
  expect(eventTimes(start, end)).toEqual(times);
});

test.each<[string, WixEvent["categories"], string | undefined, string[]]>([
  ["none", undefined, undefined, []],
  ["names tidied", [{ id: "1", name: "  Weekly   Classes " }], undefined, ["Weekly Classes"]],
  [
    "the series' own category left out",
    [
      { id: "1", name: "Classes" },
      { id: "r", name: "recurring-a" },
    ],
    "r",
    ["Classes"],
  ],
  [
    "each name once, in order",
    [
      { id: "1", name: "B" },
      { id: "2", name: "A" },
      { id: "3", name: " B" },
    ],
    undefined,
    ["B", "A"],
  ],
  ["a category without a name", [{ id: "1" }, { id: "2", name: " " }], undefined, []],
])("eventCategories: %s", (_name, categories, recurrenceId, names) => {
  expect(eventCategories(categories, recurrenceId)).toEqual(names);
});

const address = {
  formattedAddress: "1200 Canal St SW, Washington, DC 20024, USA",
  city: " Washington ",
  geocode: { latitude: 38.87, longitude: -77.01 },
};

test.each<[string, WixEvent["location"], ReturnType<typeof eventLocation>]>([
  ["no place", undefined, { location: null, warning: null }],
  ["to be decided", { name: "Somewhere", locationTbd: true }, { location: null, warning: null }],
  [
    "in person",
    { type: "VENUE", name: " The  Center ", address },
    {
      location: {
        online: false,
        name: "The Center",
        address: "1200 Canal St SW, Washington, DC 20024, USA",
        city: "Washington",
        geo: { lat: 38.87, lng: -77.01 },
      },
      warning: null,
    },
  ],
  [
    "in person without an address",
    { type: "VENUE", name: "The Center" },
    {
      location: { online: false, name: "The Center", address: null, city: null, geo: null },
      warning: "in-person event without an address",
    },
  ],
  [
    "online: no address, city or map point, whatever Wix sends",
    { type: "ONLINE", name: "Livestream", address },
    {
      location: { online: true, name: "Livestream", address: null, city: null, geo: null },
      warning: null,
    },
  ],
  [
    "no name",
    { type: "ONLINE", name: " " },
    { location: { online: true, name: null, address: null, city: null, geo: null }, warning: null },
  ],
])("eventLocation: %s", (_name, where, expected) => {
  expect(eventLocation(where)).toEqual(expected);
});

test.each<[string | undefined, boolean]>([
  ["https://static.wixstatic.com/media/abc~mv2.jpg", true],
  ["https://www.example.org/picture.jpg", false],
  ["http://static.wixstatic.com/media/abc~mv2.jpg", false],
  ["not a link", false],
  [undefined, false],
])("eventPicture: %s", (url, kept) => {
  expect(eventPicture(url)).toBe(kept ? url : null);
});
