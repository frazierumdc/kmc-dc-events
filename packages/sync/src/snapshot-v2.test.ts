import { gzipSync } from "node:zlib";
import { PublishedSite, SiteSettings, type WebsiteEvent } from "@kmcdc/domain";
import { expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import siteFile from "../../../data/site.json" with { type: "json" };
import { classId } from "./class-id.ts";
import { buildSnapshotV2, scheduleFingerprint, versionHash } from "./snapshot-v2.ts";
import { adaptWixEvent } from "./wix-adapter.ts";

const settings = SiteSettings.parse(siteFile);
const { allowedHosts } = settings;
const site = PublishedSite.parse(settings);
const NOW = new Date("2026-10-09T15:00:00Z"); // Friday 11 AM Eastern

function website(name: keyof typeof fixtures): WebsiteEvent {
  const r = adaptWixEvent(fixtures[name], allowedHosts);
  if (!r.ok) throw new Error(r.reason);
  return r.event;
}
const all = (Object.keys(fixtures) as (keyof typeof fixtures)[])
  .filter((n) => n !== "empty-address") // the same event as "prayer"
  .map(website);

function build(events: WebsiteEvent[], publishedAt = "2026-10-09T15:00:00Z", max?: number) {
  const r = buildSnapshotV2(events, site, NOW, publishedAt, max);
  if (!r.ok) throw new Error(r.error);
  return r.files;
}

test("events in start order with Eastern times, class ids and the site", () => {
  const { snapshot, manifest } = build([...all].reverse());
  expect(snapshot.events.map((e) => e.start)).toEqual(
    [...snapshot.events.map((e) => e.start)].sort((a, b) => Date.parse(a) - Date.parse(b)),
  );
  const weekly = snapshot.events.find((e) => e.title === "Tuesday Rest and Reflect");
  expect(weekly).toMatchObject({
    start: "2026-10-13T18:00:00-04:00",
    end: "2026-10-13T18:30:00-04:00",
    allDay: false,
    classId: classId(website("weekly-class")),
  });
  expect(snapshot.site).toEqual(site);
  expect(snapshot.site).not.toHaveProperty("allowedHosts");
  expect(snapshot.site).not.toHaveProperty("online");
  expect(manifest).toEqual({
    schema: 2,
    version: snapshot.version,
    publishedAt: "2026-10-09T15:00:00Z",
    snapshots: { "2": `/v2/feed/snapshots/${snapshot.version}.json` },
    schedule: scheduleFingerprint(snapshot.events),
    minAppBuild: null,
    message: null,
  });
  expect(manifest.schedule).toMatch(/^[0-9a-f]{16}$/);
  expect(snapshot.version).toMatch(/^20261009T150000Z-[0-9a-f]{8}$/);
});

test("the schedule's fingerprint: only which events are listed, and when", () => {
  const a = { id: "a", start: "2026-10-13T18:00:00-04:00", end: "2026-10-13T18:30:00-04:00" };
  const b = { id: "b", start: "2026-10-14T19:00:00-04:00", end: null };
  const print = scheduleFingerprint([a, b]);
  expect(scheduleFingerprint([b, a])).toBe(print);
  const renamed = { ...a, title: "Renamed" };
  expect(scheduleFingerprint([renamed, b])).toBe(print);
  expect(scheduleFingerprint([b])).not.toBe(print);
  expect(scheduleFingerprint([{ ...a, start: "2026-10-13T18:15:00-04:00" }, b])).not.toBe(print);
  expect(scheduleFingerprint([a, { ...b, end: b.start }])).not.toBe(print);
});

test("the hash covers the content, never the publish time", () => {
  const a = build(all, "2026-10-09T15:00:00Z").snapshot.version;
  const b = build([...all].reverse(), "2026-10-10T09:30:00Z").snapshot.version;
  expect(a).not.toBe(b);
  expect(versionHash(a)).toBe(versionHash(b));
  const edited = all.map((e, i) => (i === 0 ? { ...e, title: `${e.title}!` } : e));
  expect(versionHash(build(edited).snapshot.version)).not.toBe(versionHash(a));
});

test("from events not ended before today to 400 days ahead", () => {
  const base = website("weekly-class");
  const at = (start: string, end: string | null) => ({ ...base, id: start, start, end });
  const ids = build([
    at("2026-10-08T22:00:00Z", "2026-10-08T23:00:00Z"), // yesterday: dropped
    at("2026-10-08T13:00:00Z", "2026-10-10T16:00:00Z"), // started yesterday, still on: kept
    at("2026-10-09T12:00:00Z", null), // this morning: kept
    at("2027-11-12T23:00:00Z", null), // day 399: kept
    at("2027-11-13T05:00:00Z", null), // day 400: dropped
  ]).snapshot.events.map((e) => e.id);
  expect(ids).toEqual(["2026-10-08T13:00:00Z", "2026-10-09T12:00:00Z", "2027-11-12T23:00:00Z"]);
});

test("an event from midnight to midnight is all day", () => {
  const base = website("weekly-class");
  const [e] = build([{ ...base, start: "2026-10-12T04:00:00Z", end: "2026-10-13T04:00:00Z" }])
    .snapshot.events;
  expect(e).toMatchObject({ allDay: true, start: "2026-10-12T00:00:00-04:00" });
});

test("over the size limit, the build stops", () => {
  const { json } = build(all);
  const r = buildSnapshotV2(all, site, NOW, "2026-10-09T15:00:00Z", gzipSync(json).length - 1);
  expect(r.ok ? null : r.error).toMatch(/over the limit/);
});

test("each event carries its online option, or null", () => {
  const livestream = { type: "livestream" as const, page: settings.links.onlineClasses };
  const weekly = website("weekly-class");
  const r = buildSnapshotV2(
    [weekly, website("study-program")],
    site,
    NOW,
    "2026-10-09T15:00:00Z",
    undefined,
    new Map([[weekly.id, livestream]]),
  );
  if (!r.ok) throw new Error(r.error);
  expect(r.files.snapshot.events.map((e) => e.online)).toEqual([livestream, null]);
});
