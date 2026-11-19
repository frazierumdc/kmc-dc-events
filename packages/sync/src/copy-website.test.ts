import { SiteSettings, type FeedEnvelope } from "@kmcdc/domain";
import { expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import siteFile from "../../../data/site.json" with { type: "json" };
import { copyWebsite, deliveryLine, type CopyInput } from "./copy-website.ts";

// The website's events only; other centers' events (D67) have their own test.
const site = { ...SiteSettings.parse(siteFile), otherCenterEvents: [] };
const NOW = new Date("2026-10-09T15:00:00Z");
const events: unknown[] = Object.values(fixtures);

function feed(list: unknown[] = events, changes: Partial<FeedEnvelope> = {}): FeedEnvelope {
  return {
    generatedAt: "2026-10-09T14:58:00Z",
    window: { from: "2026-10-08T04:00:00Z", to: "2027-11-13T04:00:00Z" },
    access: "visitor",
    count: list.length,
    events: list,
    ...changes,
  };
}
const run = (input: Partial<CopyInput> = {}) =>
  copyWebsite({ feed: feed(), site, published: null, now: NOW, checkFreshness: true, ...input });

function changed(input: Partial<CopyInput> = {}) {
  const r = run(input);
  if (r.status === "failed") throw new Error(r.problem);
  return r;
}

test("first run: changed, the whole schedule, the run's summary", () => {
  const r = changed();
  expect(r.status).toBe("changed");
  // "empty-address" is the "prayer" event again, with its address emptied; the online
  // Silent Saturday belongs to the in-person one (D46).
  expect(r.files.snapshot.events).toHaveLength(9);
  expect(r.leftOut).toEqual([
    {
      id: "00d8b6ab-9eeb-4b52-9da1-72ffd600353d",
      title: "Wishfulfilling Jewel with Tsog",
      message: "the same id as an event before it",
    },
  ]);
  expect(r.summary).toContain("## Update schedule: published");
  expect(r.summary).toContain("First schedule: 9 events.");
  expect(r.summary).toContain("### Left out");
});

test("another center's event the owner asked for is listed with the website's, Register opening its page (D67)", () => {
  const withOther = SiteSettings.parse(siteFile);
  const [retreat] = withOther.otherCenterEvents;
  if (!retreat) throw new Error("no other center's event in data/site.json");
  const r = changed({ site: withOther });
  expect(r.files.snapshot.events).toHaveLength(10);
  const listed = r.files.snapshot.events.find((e) => e.id === retreat.id);
  expect(listed).toMatchObject({
    title: retreat.title,
    start: "2026-12-05T10:00:00-05:00",
    end: "2026-12-06T16:15:00-05:00",
    allDay: false,
    categories: ["Retreats & Special Events"],
    page: "https://other-center.example.org/sample-retreat",
    registrationOpen: true,
    online: null,
    location: { online: false, city: "Exampleville", name: "Example Meditation Center" },
    otherCenter: true,
  });
  // The website's own events carry no mark.
  expect(r.files.snapshot.events.filter((e) => e.otherCenter)).toHaveLength(1);
  expect(listed?.picture).toMatch(/^https:\/\/images\.squarespace-cdn\.com\//);
  // The next day it is gone from the schedule (the app hides it once it ends, as any event).
  const after = changed({
    site: withOther,
    now: new Date("2026-12-07T12:00:00Z"),
    checkFreshness: false,
  });
  expect(after.files.snapshot.events.some((e) => e.id === retreat.id)).toBe(false);
});

test("another center's event: its page on an allowed host, a category with a kind, an end after its start (D67)", () => {
  const parsed = SiteSettings.parse(siteFile);
  const [retreat] = parsed.otherCenterEvents;
  if (!retreat) throw new Error("no other center's event");
  const bad = {
    ...siteFile,
    otherCenterEvents: [
      { ...retreat, page: "https://example.com/x", categories: ["Nope"], end: retreat.start },
    ],
  };
  const issues = SiteSettings.safeParse(bad).error?.issues.map((i) => i.path.join(".")) ?? [];
  expect(issues).toEqual([
    "otherCenterEvents.0.page",
    "otherCenterEvents.0.categories.0",
    "otherCenterEvents.0.end",
  ]);
});

test("featured events: matched by their page, in the file's order; without the file the published ones are kept (EV-44)", () => {
  const first = changed();
  const [a, b] = first.files.snapshot.events;
  if (!a || !b) throw new Error("no events");
  const r = changed({
    featured: [`${b.page}/`, a.page, "https://www.example.org/event-details/nope"],
  });
  expect(r.files.snapshot.featured).toEqual([b.id, a.id]);
  expect(r.summary).toContain("### Featured");
  expect(r.summary).toContain(
    "Not shown: no event on the schedule has the page https://www.example.org/event-details/nope",
  );
  // No file read: the published schedule's are kept, and nothing changes.
  const kept = run({ published: r.files.snapshot });
  expect(kept.status).toBe("same");
  // An empty list clears them; none featured keeps the schedule's hash as before.
  const cleared = changed({ published: r.files.snapshot, featured: [] });
  expect(cleared.files.snapshot.featured).toBeUndefined();
  expect(cleared.files.snapshot.version.slice(-8)).toBe(first.files.snapshot.version.slice(-8));
});

test("the same events again: same, even published at another time", () => {
  const published = changed().files.snapshot;
  const r = changed({ published, now: new Date("2026-10-09T15:20:00Z"), checkFreshness: false });
  expect(r.status).toBe("same");
  expect(r.summary).toContain(`the same as the published schedule (${published.version})`);
});

test("warnings are listed", () => {
  const r = changed({ feed: feed([fixtures["empty-address"]]) });
  expect(r.summary).toContain("### Warnings");
  expect(r.summary).toContain("in-person event without an address");
});

test("a change on the website: changed, listed", () => {
  const published = changed().files.snapshot;
  const edited = events.map((e, i) => (i === 0 ? { ...(e as object), title: "Renamed" } : e));
  const r = changed({ feed: feed(edited), published });
  expect(r.status).toBe("changed");
  expect(r.summary).toContain("**Other details changed**");
  expect(r.summary).toContain("Renamed: title");
});

function problem(input: Partial<CopyInput>) {
  const r = run(input);
  if (r.status !== "failed") throw new Error(`expected a failed run, got ${r.status}`);
  return r;
}

test("unreadable or malformed: nothing to publish", () => {
  expect(problem({ feed: feed(events, { count: 99 }) }).problem).toMatch(
    /^Malformed: the source says 99 events but sent 11/,
  );
  expect(problem({ feed: feed(events, { generatedAt: "2026-10-09T14:00:00Z" }) }).problem).toMatch(
    /not from now/,
  );
  const broken = [...events, { id: "x", title: 5 }, { id: "y", title: 6 }];
  const r = problem({ feed: feed(broken) });
  expect(r.problem).toMatch(/2 of 13 events can't be read/);
  expect(r.summary).toContain("The app keeps the last published schedule.");
});

test("up to 10% unreadable: published, the rest listed as left out", () => {
  const r = changed({ feed: feed([...events, { id: "x", title: 5 }]) });
  const unreadable = r.leftOut.find((n) => n.id === "x");
  expect(unreadable?.message).toMatch(/^unreadable/);
  expect(r.summary).toContain("### Left out");
});

test("empty while 20 or more are published: nothing to publish", () => {
  const published = changed().files.snapshot;
  const many = { ...published, events: Array.from({ length: 20 }, () => published.events[0]) };
  expect(problem({ feed: feed([]), published: many as typeof published }).problem).toBe(
    "Empty: the source has no events, while the published schedule has 20.",
  );
  expect(run({ feed: feed([]), published }).status).toBe("changed");
});

test("a category without a kind is published and named in the summary (D45)", () => {
  expect(changed().kindless.size).toBe(0);
  expect(changed().summary).not.toContain("without a kind");
  expect(changed().files.snapshot.site.categoryKinds).toEqual(site.categoryKinds);
  const rest = { ...site.categoryKinds };
  delete rest["Chanted Prayers"];
  const r = changed({ site: { ...site, categoryKinds: rest } });
  expect([...r.kindless]).toEqual([["Chanted Prayers", 3]]);
  expect(r.summary).toContain(
    "### Categories without a kind\n\n- Chanted Prayers (3 events): shown under All without colour until it is added to `categoryKinds` in `data/site.json`",
  );
});

test("online options: the online event belongs to its in-person event; livestreams; the icon (D46)", () => {
  const r = changed();
  const byTitle = (title: string) => r.files.snapshot.events.find((e) => e.title === title);
  expect(byTitle("Online: Silent Saturday: A Heart of Gratitude")).toBeUndefined();
  expect(byTitle("Silent Saturday Retreat - A Heart of Gratitude")?.online).toMatchObject({
    type: "event",
    page: expect.stringContaining("/event-details/online-silent-saturday") as string,
  });
  const livestream = { type: "livestream", page: site.links.onlineClasses };
  expect(byTitle("Tuesday Rest and Reflect")?.online).toEqual(livestream);
  expect(byTitle("Wishfulfilling Jewel with Tsog")?.online).toEqual(livestream);
  expect(byTitle("The Foundation Program")?.online).toBeNull();
  expect(byTitle("Richmond Meditation Class")?.online).toBeNull();
  expect(byTitle("International Fall Festival")?.online).toEqual({ type: "iconOnly" });
});

test("an online event with no in-person event is listed on its own, with a note", () => {
  const r = changed({ feed: feed([fixtures.online]) });
  expect(r.files.snapshot.events.map((e) => e.title)).toEqual([
    "Online: Silent Saturday: A Heart of Gratitude",
  ]);
  expect(r.summary).toContain("### Online schedule");
  expect(r.summary).toContain("an online event with no in-person event starting at the same time");
});

test("the summary's delivery line: how long the newest edit waited for this copy", () => {
  const at = new Date("2026-11-12T01:04:52Z");
  const edited = [
    { updatedDate: "2026-11-12T01:02:34.000Z" },
    { updatedDate: "2026-11-09T20:27:04.000Z" },
    {},
  ];
  expect(deliveryLine(feed(edited), at)).toBe(
    "Newest edit on the website: 2026-11-12T01:02:34.000Z, 2.3 minutes before this copy.",
  );
  // Nothing edited in the last day: the line would say nothing about this copy.
  expect(deliveryLine(feed(edited.slice(1)), at)).toBeNull();
  expect(deliveryLine(feed([{}]), at)).toBeNull();
});
