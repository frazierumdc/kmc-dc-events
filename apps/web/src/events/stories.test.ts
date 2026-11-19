import { expect, test } from "vitest";
import { featuredStories } from "./stories.ts";
import { golden, goldenEvent } from "../../test/schedule.ts";

// The featured events' stories (EV-44): in the file's order, only those not ended.

const festival = goldenEvent("International Fall Festival");
const rest = goldenEvent("Tuesday Rest and Reflect");

test("the featured events in order, each with its picture, when, where and Register", () => {
  const snapshot = { ...golden.snapshot, featured: [rest.id, festival.id, "gone"] };
  const stories = featuredStories(snapshot, new Date("2026-10-09T12:00:00Z"));
  expect(stories.map((s) => s.title)).toEqual([
    "Tuesday Rest and Reflect",
    "International Fall Festival",
  ]);
  expect(stories[1]).toMatchObject({
    where: "Málaga",
    // Its registration is closed on the website: More info, as in its panel (D36).
    link: { label: "More info", href: festival.page },
    kind: "special",
  });
  expect(stories[1]?.when).toContain("2026");
});

test("an event that has ended isn't shown; none featured, none shown", () => {
  const snapshot = { ...golden.snapshot, featured: [festival.id] };
  expect(featuredStories(snapshot, new Date("2027-01-01T12:00:00Z"))).toEqual([]);
  expect(featuredStories(golden.snapshot, new Date("2026-10-09T12:00:00Z"))).toEqual([]);
  expect(featuredStories(null, new Date())).toEqual([]);
});
