import { expect, test } from "vitest";
import fixtures from "../fixtures/wix-events.json" with { type: "json" };
import { hasReadChanges, type FeedEnvelope } from "@kmcdc/domain";
import { websiteReadChanges } from "./website-read-changes.ts";

// The Schedule changes email's comparison (AN-1, D62): two reads of all the website's events,
// matched by id. Real events from the Wix feed; nothing of the app's schedule is involved.

type Raw = (typeof fixtures)["weekly-class"];
const events = Object.values(fixtures) as Raw[];
const READ_AT = "2026-10-09T08:07:00Z";
const read = (list: unknown[], generatedAt = READ_AT): FeedEnvelope => ({
  generatedAt,
  window: {
    from: new Date(Date.parse(generatedAt) - 86_400_000).toISOString(),
    to: new Date(Date.parse(generatedAt) + 400 * 86_400_000).toISOString(),
  },
  access: "elevated",
  count: list.length,
  events: list,
});
const richmond = fixtures.richmond;
const others = events.filter((e) => e.id !== richmond.id);
const withRichmond = (edit: (e: Raw) => unknown) => [...others, edit(richmond as Raw)];
const counts = (c: ReturnType<typeof websiteReadChanges>) =>
  c && [c.moved.length, c.added.length, c.cancelled.length, c.removed.length, c.edited.length];

test("the first read is only kept; the same website twice is no change", () => {
  expect(websiteReadChanges(null, read(events))).toBeNull();
  const same = websiteReadChanges(read(events), read(events, "2026-10-10T08:07:00Z"));
  expect(counts(same)).toEqual([0, 0, 0, 0, 0]);
  expect(same && hasReadChanges(same)).toBe(false);
  expect(same?.readAt).toBe("2026-10-10T08:07:00Z");
});

test("an event that ended is still in the read, as ended: not a change", () => {
  const ended = withRichmond((e) => ({ ...e, status: "ENDED" }));
  expect(counts(websiteReadChanges(read(events), read(ended)))).toEqual([0, 0, 0, 0, 0]);
});

test("an event gone from the read because its time passed isn't removed", () => {
  // Richmond ends on 13 Oct, 00:00 UTC; two days later it has left the read's window.
  const later = websiteReadChanges(read(events), read(others, "2026-10-15T08:07:00Z"));
  expect(later?.removed).toEqual([]);
});

test("cancelled: still on the website, now cancelled; told once", () => {
  const cancelled = withRichmond((e) => ({ ...e, status: "CANCELED" }));
  const c = websiteReadChanges(read(events), read(cancelled));
  expect(counts(c)).toEqual([0, 0, 1, 0, 0]);
  expect(c?.cancelled[0]).toEqual({
    id: richmond.id,
    title: "Richmond Meditation Class",
    start: "2026-10-12T23:00:00.000Z",
    end: "2026-10-13T00:00:00.000Z",
    allDay: false,
    place: "Diversity Thrift",
    page: `${richmond.eventPageUrl.base}${richmond.eventPageUrl.path}`,
  });
  expect(counts(websiteReadChanges(read(cancelled), read(cancelled)))).toEqual([0, 0, 0, 0, 0]);
  // Deleted after it was cancelled: nothing more to tell.
  expect(counts(websiteReadChanges(read(cancelled), read(others)))).toEqual([0, 0, 0, 0, 0]);
});

test("removed: gone from the website before it ended", () => {
  const c = websiteReadChanges(read(events), read(others));
  expect(counts(c)).toEqual([0, 0, 0, 1, 0]);
  expect(c?.removed[0]?.title).toBe("Richmond Meditation Class");
});

test("new: on the website now and not before, or on again after a cancellation", () => {
  expect(websiteReadChanges(read(others), read(events))?.added.map((e) => e.title)).toEqual([
    "Richmond Meditation Class",
  ]);
  const cancelled = withRichmond((e) => ({ ...e, status: "CANCELED" }));
  expect(counts(websiteReadChanges(read(cancelled), read(events)))).toEqual([0, 1, 0, 0, 0]);
});

test("an event that only came into the read's window isn't new", () => {
  const far = withRichmond((e) => ({
    ...e,
    dateAndTimeSettings: {
      ...e.dateAndTimeSettings,
      startDate: "2027-11-14T00:00:00.000Z",
      endDate: "2027-11-14T01:00:00.000Z",
    },
  }));
  // The earlier read reached 13 Nov 2027; the next day's reaches the 14th.
  const c = websiteReadChanges(read(others), read(far, "2026-10-10T08:07:00Z"));
  expect(c?.added).toEqual([]);
});

test("date or time changed, with what else changed on it", () => {
  const moved = withRichmond((e) => ({
    ...e,
    title: "Richmond Evening Class",
    dateAndTimeSettings: { ...e.dateAndTimeSettings, startDate: "2026-10-12T23:30:00.000Z" },
  }));
  const c = websiteReadChanges(read(events), read(moved));
  expect(counts(c)).toEqual([1, 0, 0, 0, 0]);
  expect(c?.moved[0]?.before.start).toBe("2026-10-12T23:00:00.000Z");
  expect(c?.moved[0]?.after.start).toBe("2026-10-12T23:30:00.000Z");
  expect(c?.moved[0]?.fields).toEqual(["title"]);
  const ends = withRichmond((e) => ({
    ...e,
    dateAndTimeSettings: { ...e.dateAndTimeSettings, endDate: "2026-10-13T00:30:00.000Z" },
  }));
  expect(counts(websiteReadChanges(read(events), read(ends)))).toEqual([1, 0, 0, 0, 0]);
});

test("renamed: told with its earlier name", () => {
  const renamed = withRichmond((e) => ({ ...e, title: "Richmond Class" }));
  const c = websiteReadChanges(read(events), read(renamed));
  expect(counts(c)).toEqual([0, 0, 0, 0, 1]);
  expect(c?.edited[0]?.fields).toEqual(["title"]);
  expect(c?.edited[0]?.before.title).toBe("Richmond Meditation Class");
});

test("a description, another detail the email doesn't tell, or a field Wix changes by itself, is no change", () => {
  const touched = withRichmond((e) => ({
    ...e,
    status: "STARTED",
    shortDescription: "Other words.",
    description: null,
    updatedDate: "2026-10-09T08:00:00.000Z",
    registration: { ...e.registration, status: "CLOSED_MANUALLY" },
    mainImage: { url: "https://static.wixstatic.com/media/other.jpg" },
    location: { ...e.location, name: "Diversity Thrift " },
  }));
  expect(counts(websiteReadChanges(read(events), read(touched)))).toEqual([0, 0, 0, 0, 0]);
});

test("a read kept before statuses were sent compares as all listed", () => {
  const old = events.map((e) => ({ ...e, status: undefined }));
  expect(counts(websiteReadChanges(read(old), read(others)))).toEqual([0, 0, 0, 1, 0]);
});
