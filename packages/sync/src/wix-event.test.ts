import { expect, test } from "vitest";
import { WixEvent } from "./wix-event.ts";

const event = {
  id: "3efe9c7a-d27a-480c-912b-3ba7ed7de483",
  title: "Wednesday Step by Step Meditation",
  status: "UPCOMING",
  dateAndTimeSettings: {
    startDate: "2026-10-07T23:00:00.000Z",
    endDate: "2026-10-08T00:00:00.000Z",
    timeZoneId: "America/New_York",
  },
};

test("an event keeps fields the schema doesn't name", () => {
  const parsed = WixEvent.parse({
    ...event,
    eventDisplaySettings: { hideEventDetailsButton: false },
  });
  expect(parsed).toHaveProperty("eventDisplaySettings");
});

test("an event needs an id, and dates must be instants", () => {
  expect(WixEvent.safeParse({ ...event, id: "" }).success).toBe(false);
  expect(
    WixEvent.safeParse({ ...event, dateAndTimeSettings: { startDate: "next Wednesday" } }).success,
  ).toBe(false);
});
