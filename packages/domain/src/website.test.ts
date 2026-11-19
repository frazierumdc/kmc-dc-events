import { expect, test } from "vitest";
import site from "../../../data/site.json" with { type: "json" };
import {
  alsoAClass,
  eventKind,
  isAllowedUrl,
  PublishedSite,
  SiteSettings,
  SnapshotV2Event,
  WebsiteEvent,
} from "./website.ts";

const event: WebsiteEvent = {
  id: "3efe9c7a-d27a-480c-912b-3ba7ed7de483",
  title: "Wednesday Step by Step Meditation",
  summary: null,
  description: null,
  start: "2026-10-14T23:00:00Z",
  end: null,
  categories: ["Weekly Meditation Classes"],
  location: null,
  page: "https://www.example.org/event-details/wednesday-step-by-step-meditation",
  registrationOpen: true,
  picture: null,
};

test("an event's picture is only from Wix's media server, and an older schedule has none (slice 1.13)", () => {
  const picture =
    "https://static.wixstatic.com/media/7399f8_97e14fcb0db643238b516beb9f20839f~mv2.jpg";
  expect(WebsiteEvent.safeParse({ ...event, picture }).success).toBe(true);
  expect(WebsiteEvent.safeParse({ ...event, picture: "https://example.com/a.jpg" }).success).toBe(
    false,
  );
  expect(
    WebsiteEvent.safeParse({ ...event, picture: "http://static.wixstatic.com/media/a.jpg" })
      .success,
  ).toBe(false);
});

test("a website event is checked strictly: no fields of the app's own (D36)", () => {
  expect(WebsiteEvent.safeParse(event).success).toBe(true);
  expect(WebsiteEvent.safeParse({ ...event, kind: "class" }).success).toBe(false);
  expect(WebsiteEvent.safeParse({ ...event, start: "2026-10-14T19:00:00-04:00" }).success).toBe(
    false,
  );
  expect(WebsiteEvent.safeParse({ ...event, page: "http://www.example.org/x" }).success).toBe(
    false,
  );
});

test("site settings: the repository's file is valid; links must be on an allowed host", () => {
  expect(SiteSettings.safeParse(site).error).toBeUndefined();
  const bad = { ...site, links: { onlineClasses: "https://example.com/online-classes" } };
  expect(SiteSettings.safeParse(bad).error?.issues[0]?.path).toEqual(["links", "onlineClasses"]);
  expect(SiteSettings.safeParse({ ...site, colours: {} }).success).toBe(false);
});

test("isAllowedUrl: https on an allowed host only", () => {
  const hosts = ["www.example.org"];
  expect(isAllowedUrl("https://www.example.org/a", hosts)).toBe(true);
  expect(isAllowedUrl("http://www.example.org/a", hosts)).toBe(false);
  expect(isAllowedUrl("https://example.org.evil.com/a", hosts)).toBe(false);
  expect(isAllowedUrl("not a url", hosts)).toBe(false);
});

test("an event's kind follows from its categories: Special, then Classes, then Prayers (D45)", () => {
  const { categoryKinds } = SiteSettings.parse(site);
  expect(eventKind(["Weekly Meditation Classes"], categoryKinds)).toBe("class");
  expect(eventKind(["Online Special Events"], categoryKinds)).toBe("special");
  expect(eventKind(["Chanted Prayers", "Retreats & Special Events"], categoryKinds)).toBe(
    "special",
  );
  expect(eventKind(["Chanted Prayers", "Study Programs"], categoryKinds)).toBe("class");
  expect(eventKind(["Members Only"], categoryKinds)).toBeNull();
  expect(eventKind([], categoryKinds)).toBeNull();
});

test("a special event the website also lists as a weekly class is also under Classes (D45)", () => {
  const { categoryKinds } = SiteSettings.parse(site);
  // 29 November 2026: a special Sunday morning meditation in the weekly class's time.
  const both = ["Weekly Meditation Classes", "Retreats & Special Events"];
  expect(eventKind(both, categoryKinds)).toBe("special");
  expect(alsoAClass(both, categoryKinds)).toBe(true);
  expect(alsoAClass(["Online Special Events", "Study Programs"], categoryKinds)).toBe(true);
  expect(alsoAClass(["Retreats & Special Events"], categoryKinds)).toBe(false);
  expect(alsoAClass(["Weekly Meditation Classes"], categoryKinds)).toBe(false);
  // Only classes and special events, for now: a special prayer is not also a prayer.
  expect(alsoAClass(["Chanted Prayers", "Retreats & Special Events"], categoryKinds)).toBe(false);
});

test("site settings: every category's kind is one of the three; phones get the table", () => {
  const parsed = SiteSettings.parse(site);
  expect(Object.keys(parsed.categoryKinds)).toHaveLength(6);
  const bad = { ...site, categoryKinds: { "Chanted Prayers": "prayers" } };
  expect(SiteSettings.safeParse(bad).error?.issues[0]?.path).toEqual([
    "categoryKinds",
    "Chanted Prayers",
  ]);
  expect(PublishedSite.parse(parsed).categoryKinds).toEqual(parsed.categoryKinds);
  expect(PublishedSite.parse(parsed)).not.toHaveProperty("allowedHosts");
  // A schedule published before the table existed reads as having no kinds.
  const older: Record<string, unknown> = { ...PublishedSite.parse(parsed) };
  delete older.categoryKinds;
  expect(PublishedSite.parse(older).categoryKinds).toEqual({});
});

test("site settings: the online schedule (D46) names known categories and isn't published", () => {
  const parsed = SiteSettings.parse(site);
  expect(parsed.online.livestreams.map((l) => l.category)).toEqual([
    "Weekly Meditation Classes",
    "Chanted Prayers",
  ]);
  const typo = {
    ...site,
    online: { livestreams: [{ category: "Chanted Prayer" }] },
  };
  expect(SiteSettings.safeParse(typo).error?.issues[0]?.path).toEqual([
    "online",
    "livestreams",
    0,
    "category",
  ]);
  const badTime = {
    ...site,
    online: {
      livestreams: [
        { category: "Weekly Meditation Classes", times: [{ day: "sun", start: "7pm" }] },
      ],
    },
  };
  expect(SiteSettings.safeParse(badTime).success).toBe(false);
  expect(parsed.online.iconOnly).toEqual([
    { category: "Retreats & Special Events", titleWord: "Festival" },
  ]);
  const iconTypo = {
    ...site,
    online: { livestreams: [], iconOnly: [{ category: "Retreat", titleWord: "Festival" }] },
  };
  expect(SiteSettings.safeParse(iconTypo).error?.issues[0]?.path).toEqual([
    "online",
    "iconOnly",
    0,
    "category",
  ]);
  const twoWords = {
    ...site,
    online: {
      livestreams: [],
      iconOnly: [{ category: "Retreats & Special Events", titleWord: "Fall Festival" }],
    },
  };
  expect(SiteSettings.safeParse(twoWords).success).toBe(false);
  const without: Record<string, unknown> = { ...site };
  delete without.online;
  expect(SiteSettings.parse(without).online).toEqual({ livestreams: [], iconOnly: [] });
  expect(PublishedSite.parse(parsed)).not.toHaveProperty("online");
});

test("snapshot events: no online option reads as none; an unknown one too", () => {
  const listed = {
    ...event,
    classId: "c_4QJ8M2VX7K1D",
    start: "2026-10-14T19:00:00-04:00",
    allDay: false,
  };
  expect(SnapshotV2Event.parse(listed).online).toBeNull();
  const livestream = { type: "livestream", page: "https://www.example.org/online-classes" };
  expect(SnapshotV2Event.parse({ ...listed, online: livestream }).online).toEqual(livestream);
  const twin = {
    type: "event",
    id: "a1",
    page: "https://www.example.org/event-details/online-silent-saturday",
    registrationOpen: true,
  };
  expect(SnapshotV2Event.parse({ ...listed, online: twin }).online).toEqual(twin);
  const icon = { type: "iconOnly" };
  expect(SnapshotV2Event.parse({ ...listed, online: icon }).online).toEqual(icon);
  expect(SnapshotV2Event.parse({ ...listed, online: { type: "phone" } }).online).toBeNull();
});

test("site settings: the membership card's words; its link on an allowed host; phones get it", () => {
  const parsed = SiteSettings.parse(site);
  expect(parsed.membership?.benefits).toHaveLength(3);
  const away = { ...site, membership: { ...site.membership, link: "https://example.com/plans" } };
  expect(SiteSettings.safeParse(away).error?.issues[0]?.path).toEqual(["membership", "link"]);
  const four = { ...site, membership: { ...site.membership, benefits: ["a", "b", "c", "d"] } };
  expect(SiteSettings.safeParse(four).success).toBe(false);
  expect(PublishedSite.parse(parsed).membership).toEqual(parsed.membership);
  // A schedule published before the card existed, or with a card this app can't read: none.
  const older: Record<string, unknown> = { ...PublishedSite.parse(parsed) };
  delete older.membership;
  expect(PublishedSite.parse(older).membership).toBeNull();
  expect(PublishedSite.parse({ ...older, membership: { title: 1 } }).membership).toBeNull();
});
