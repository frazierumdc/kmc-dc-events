import { expect, test } from "vitest";
import { FeedEnvelope } from "./feed.ts";

test("the envelope accepts visitor or elevated access only, and leaves events unparsed", () => {
  const envelope = {
    generatedAt: "2026-10-07T18:38:00.000Z",
    window: { from: "2026-10-06T18:38:00.000Z", to: "2027-11-11T18:38:00.000Z" },
    access: "visitor",
    count: 1,
    events: [{ not: "an event" }],
  };
  expect(FeedEnvelope.parse(envelope).events).toEqual([{ not: "an event" }]);
  expect(FeedEnvelope.safeParse({ ...envelope, access: "admin" }).success).toBe(false);
});
