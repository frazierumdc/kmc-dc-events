import { FeedEnvelope } from "@kmcdc/domain";
import { expect, test } from "vitest";
import sample from "../fixtures/feed-sample.json" with { type: "json" };
import { summarizeFeed } from "./summarize-feed.ts";

const feed = FeedEnvelope.parse(sample);

test("counts statuses, venues, addresses, online events and categories", () => {
  const summary = summarizeFeed(feed);
  expect(summary.count).toBe(5);
  expect(summary.statuses).toEqual({ UPCOMING: 3, STARTED: 1 });
  expect(summary.venues).toBe(3);
  expect(summary.venuesWithAddress).toBe(2);
  expect(summary.online).toBe(1);
  expect(summary.withCategories).toBe(3);
});

test("an event without an id is unreadable, which fails the check", () => {
  const summary = summarizeFeed(feed);
  expect(summary.unreadable).toEqual([
    { id: undefined, reason: "id Invalid input: expected string, received undefined" },
  ]);
  expect(summary.problems).toEqual(["1 events fail the schema"]);
  expect(summary.warnings).toEqual(["1 in-person events have no address"]);
});

test("a good feed has no problems or warnings", () => {
  const good = { ...feed, count: 3, events: feed.events.slice(0, 3) };
  const summary = summarizeFeed(good);
  expect(summary.problems).toEqual([]);
  expect(summary.warnings).toEqual([]);
});

test("a count that doesn't match, no events, or elevated access are reported", () => {
  expect(summarizeFeed({ ...feed, count: 9 }).problems).toContain(
    "count says 9 but 5 events were sent",
  );
  expect(summarizeFeed({ ...feed, count: 0, events: [] }).problems).toContain(
    "no events: the feed's filter or field names may differ",
  );
  expect(summarizeFeed({ ...feed, access: "elevated" }).warnings).toContain(
    "access is elevated, not visitor",
  );
});
