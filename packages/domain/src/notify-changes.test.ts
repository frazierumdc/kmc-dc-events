import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { notifyChanges } from "./notify-changes.ts";
import { SnapshotV2, type SnapshotV2Event } from "./website.ts";

// What a publish sends (NT-11 – NT-16), on the golden schedule's real events, as published
// on 12 October 2026 at noon: a cancelled or moved event notifies its lists once; nothing
// else does.
const before = SnapshotV2.parse(
  JSON.parse(readFileSync(new URL("../golden/snapshot-v2.json", import.meta.url), "utf8")),
);
const now = new Date("2026-10-12T16:00:00Z");
const byTitle = (title: string) =>
  before.events.find((e) => e.title.startsWith(title)) as SnapshotV2Event;
const after = (change: (events: SnapshotV2Event[]) => SnapshotV2Event[]): SnapshotV2 => ({
  ...before,
  events: change(before.events.map((e) => ({ ...e }))),
});
const without = (title: string) =>
  after((events) => events.filter((e) => e !== byTitle(title) && e.id !== byTitle(title).id));
const changed = (title: string, fields: Partial<SnapshotV2Event>) =>
  after((events) => events.map((e) => (e.id === byTitle(title).id ? { ...e, ...fields } : e)));

test("a cancelled class: its weekly class and itself, once (NT-11, NT-14)", () => {
  const rest = byTitle("Tuesday Rest and Reflect");
  const [notice, ...more] = notifyChanges(before, without("Tuesday Rest and Reflect"), now);
  expect(more).toEqual([]);
  expect(notice?.kind).toBe("cancelled");
  expect(notice?.lists).toEqual([`class-${rest.classId}`, `event-${rest.id}`]);
  expect(notice?.send.message).toMatchObject({
    condition: `'class-${rest.classId}' in topics || 'event-${rest.id}' in topics`,
    webpush: {
      // Until it would have started (NT-16): 13 October, 6 PM Eastern.
      headers: { TTL: String(Date.parse("2026-10-13T22:00:00Z") / 1000 - now.getTime() / 1000) },
      data: {
        title: "Cancelled: Tuesday Rest and Reflect",
        // Tapping opens the list at the date it was on, not an event (NT-15).
        url: "/?day=2026-10-13",
        tag: rest.id,
      },
    },
  });
  expect(notice?.send.message.webpush.data.body).toMatch(/2026.*6:00 – 6:30 PM Eastern$/);
});

test("a new time says the new one and the old (NT-15)", () => {
  const prayers = byTitle("Wishfulfilling Jewel");
  const [notice] = notifyChanges(
    before,
    changed("Wishfulfilling Jewel", {
      start: "2026-10-18T18:00:00-04:00",
      end: "2026-10-18T19:15:00-04:00",
    }),
    now,
  );
  expect(notice?.kind).toBe("moved");
  expect(notice?.lists).toEqual([`class-${prayers.classId}`, `event-${prayers.id}`]);
  const data: Record<string, string> = notice?.send.message.webpush.data ?? {};
  expect(data.title).toBe("New time: Wishfulfilling Jewel with Tsog");
  expect(data.body).toMatch(/^Now .*6:00 – 7:15 PM Eastern\. Was .*5:00 – 6:15 PM Eastern\.$/);
  // Tapping opens the list at its new date, not the event (NT-15).
  expect(data.url).toBe("/?day=2026-10-18");
});

test("a study program's session also goes to its program's list, whatever its title's form (owner, 13 November)", () => {
  const rest = byTitle("Tuesday Rest and Reflect");
  const ttp = { ...rest, title: "Teacher Training Program (TTP)", categories: ["Study Programs"] };
  const site = {
    ...before.site,
    programs: [
      {
        id: "ttp" as const,
        shortName: "TTP",
        category: "Study Programs",
        titles: ["Teacher Training Program", "Teacher Training Program (TTP)"],
      },
    ],
  };
  const withTtp = {
    ...before,
    site,
    events: before.events.map((e) => (e.id === rest.id ? ttp : e)),
  };
  const cancelled = { ...withTtp, events: withTtp.events.filter((e) => e.id !== rest.id) };
  const [notice] = notifyChanges(withTtp, cancelled, now);
  expect(notice?.lists).toEqual([`class-${rest.classId}`, `event-${rest.id}`, "program-ttp"]);
});

test("no event type's list hears of a change: events are followed one by one (owner, 13 November)", () => {
  const moved = changed("Tuesday Rest and Reflect", {
    start: "2026-10-14T18:00:00-04:00",
    end: "2026-10-14T18:30:00-04:00",
  });
  expect(JSON.stringify(notifyChanges(before, moved, now)[0]?.send.message)).not.toContain("type-");
});

test("nothing for a new event, an edit, a place, or an event that already started (NT-11)", () => {
  const festival = byTitle("International Fall Festival");
  const edits = after((events) => [
    ...events
      .filter((e) => e.id !== festival.id)
      .map((e) =>
        e.title.startsWith("Tuesday Rest")
          ? { ...e, title: "Tuesday Rest & Reflect", description: "New words" }
          : e.title.startsWith("Richmond")
            ? { ...e, location: null }
            : e,
      ),
    { ...festival, id: "new-event", start: "2026-10-20T19:00:00-04:00", end: null },
  ]);
  expect(notifyChanges(before, edits, now)).toEqual([]);
});

test("nothing on the first publish", () => {
  expect(notifyChanges(null, before, now)).toEqual([]);
});
