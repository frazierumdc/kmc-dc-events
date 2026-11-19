// @vitest-environment node
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { storyPath, thumbnailPath } from "@kmcdc/domain";
import {
  eventFiles,
  scheduleFiles,
  storyFiles,
  thumbnailFiles,
  unchangedEvents,
  type Kept,
} from "./schedule-files.ts";
import { editedSchedule, golden } from "../test/schedule.ts";

// A schedule's files on the site (D63): an event that hasn't changed keeps its three files,
// so a publish draws and sends only what an edit touched.

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const INDEX = '<html><head><title>x</title><meta name="description" content="x" /></head></html>';
const source = (schedule: typeof golden) => ({
  manifest: bytes(schedule.manifest),
  snapshot: bytes(schedule.snapshot),
  indexHtml: INDEX,
  origin: "https://example.org",
});

/** The site as if `golden` were published: every event's three files, named by a hash. */
const live = () => ({
  snapshot: bytes(golden.snapshot),
  hashes: new Map(
    golden.snapshot.events.flatMap((e) => eventFiles(e.id).map((f) => [f, `hash of ${f}`])),
  ),
});

const moved = editedSchedule((events) =>
  events.map((e) =>
    e.title === "Tuesday Rest and Reflect"
      ? { ...e, start: "2026-10-13T18:30:00-04:00", end: "2026-10-13T19:00:00-04:00" }
      : e,
  ),
);
const movedId =
  golden.snapshot.events.find((e) => e.title === "Tuesday Rest and Reflect")?.id ?? "";
const isKept = (value: unknown): value is Kept =>
  typeof value === "object" && value !== null && "kept" in value;

test("every event is unchanged when the same events are published again", () => {
  expect(unchangedEvents(moved.snapshot, null).size).toBe(0);
  expect(unchangedEvents(golden.snapshot, live()).size).toBe(golden.snapshot.events.length);
});

test("an edited event, a new one, or one with a file missing on the site is made again", () => {
  const same = unchangedEvents(moved.snapshot, live());
  expect(same.has(movedId)).toBe(false);
  expect(same.size).toBe(golden.snapshot.events.length - 1);

  const added = editedSchedule((events) => [...events, { ...events[0], id: "brand-new" }] as never);
  expect(unchangedEvents(added.snapshot, live()).has("brand-new")).toBe(false);

  const site = live();
  const other = golden.snapshot.events[1]?.id ?? "";
  site.hashes.delete(eventFiles(other)[2] ?? "");
  expect(unchangedEvents(golden.snapshot, site).has(other)).toBe(false);
});

test("changed site settings, or a published schedule that can't be read, keep nothing", () => {
  const settings = {
    ...golden.snapshot,
    site: { ...golden.snapshot.site, center: { ...golden.snapshot.site.center, name: "Renamed" } },
  };
  expect(unchangedEvents(settings, live()).size).toBe(0);
  expect(
    unchangedEvents(golden.snapshot, { ...live(), snapshot: new TextEncoder().encode("not json") })
      .size,
  ).toBe(0);
});

test("a publish makes the schedule's own files and the edited event's; the rest are kept", async () => {
  const files = await scheduleFiles(source(moved), live());
  const made = [...files].filter(([, v]) => !isKept(v)).map(([name]) => name);
  expect(made.sort()).toEqual(
    [
      "/v2/feed/manifest.json",
      "/v2/feed/latest.json",
      moved.manifest.snapshots["2"],
      ...eventFiles(movedId),
    ].sort(),
  );
  const [ics = "", page = "", picture = ""] = eventFiles(movedId);
  expect(files.get(ics)).toContain("BEGIN:VEVENT");
  expect(files.get(page)).toContain("og:title");
  expect((files.get(picture) as Uint8Array).subarray(1, 4).toString()).toBe("PNG");
  const other = golden.snapshot.events.find((e) => e.id !== movedId)?.id ?? "";
  expect(files.get(eventFiles(other)[2] ?? "")).toEqual({
    kept: `hash of ${eventFiles(other)[2] ?? ""}`,
  });
  expect(files.size).toBe(3 + golden.snapshot.events.length * 3);
});

// Each event picture's thumbnail on the site (slice 1.13): fetched once per picture, kept
// when it is there already, and left out when it can't be fetched.
const PICTURE =
  "https://static.wixstatic.com/media/7399f8_97e14fcb0db643238b516beb9f20839f~mv2.jpg";
const OTHER = "https://static.wixstatic.com/media/9c5296_f7e96663917c4791aec5f295169f7e94~mv2.png";
const pictured = editedSchedule((events) =>
  events.map((e, i) => ({ ...e, picture: i < 2 ? PICTURE : i === 2 ? OTHER : null })),
);

test("each picture's thumbnail is fetched once, however many events show it", async () => {
  const asked: string[] = [];
  const files = await thumbnailFiles(pictured.snapshot, null, (picture) => {
    asked.push(picture);
    return Promise.resolve(new Uint8Array([0xff, 0xd8]));
  });
  expect(asked).toEqual([PICTURE, OTHER]);
  expect([...files.keys()]).toEqual([thumbnailPath(PICTURE), thumbnailPath(OTHER)]);
});

test("a thumbnail already on the site is kept; one that can't be fetched is left out", async () => {
  const asked: string[] = [];
  const files = await thumbnailFiles(
    pictured.snapshot,
    { hashes: new Map([[thumbnailPath(PICTURE), "hash of it"]]) },
    (picture) => {
      asked.push(picture);
      return Promise.resolve(null);
    },
  );
  expect(asked).toEqual([OTHER]);
  expect(files.get(thumbnailPath(PICTURE))).toEqual({ kept: "hash of it" });
  expect(files.has(thumbnailPath(OTHER))).toBe(false);
});

test("the schedule's files include its thumbnails", async () => {
  const files = await scheduleFiles(source(pictured), null, () =>
    Promise.resolve(new Uint8Array([1])),
  );
  expect(files.has(thumbnailPath(PICTURE))).toBe(true);
  expect(files.has(thumbnailPath(OTHER))).toBe(true);
});

// Another center's picture, kept in data/pictures/ (D67).
const ELSEWHERE = "https://images.squarespace-cdn.com/content/v1/example/sample-retreat.jpg";

test("another center's pictures come from the repository: its site's image server isn't asked (D67)", async () => {
  const schedule = editedSchedule((events) =>
    events.map((e, i) => ({ ...e, picture: i === 0 ? ELSEWHERE : null })),
  );
  const featured = { ...schedule.snapshot, featured: [schedule.snapshot.events[0]?.id ?? ""] };
  const asked: string[] = [];
  const ask = (picture: string) => {
    asked.push(picture);
    return Promise.resolve(null);
  };
  const thumbnails = await thumbnailFiles(schedule.snapshot, null, ask);
  const stories = await storyFiles(featured, null, ask);
  expect(asked).toEqual([]);
  const kept = (file: string) =>
    new Uint8Array(
      readFileSync(
        new URL(`../../../data/pictures/${file.split("/").pop() ?? ""}`, import.meta.url),
      ),
    );
  expect(thumbnails.get(thumbnailPath(ELSEWHERE))).toEqual(kept(thumbnailPath(ELSEWHERE)));
  expect(stories.get(storyPath(ELSEWHERE))).toEqual(kept(storyPath(ELSEWHERE)));
});
