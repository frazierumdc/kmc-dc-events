import { expect, test } from "vitest";
import { dayAddress, dayFromSearch } from "./day-address.ts";

// A notification opens the list at the event's date, not the event (NT-15).
test("the address is the list at the event's Eastern date", () => {
  expect(dayAddress("2026-11-18T19:00:00-05:00")).toBe("/?day=2026-11-18");
  // 11:30 PM Eastern is already the next day in UTC.
  expect(dayAddress("2026-11-19T04:30:00Z")).toBe("/?day=2026-11-18");
});

test("the app reads the date back, and nothing that isn't one", () => {
  expect(dayFromSearch(new URL(dayAddress("2026-11-18T19:00:00-05:00"), "https://x").search)).toBe(
    "2026-11-18",
  );
  for (const search of [
    "",
    "?day=",
    "?day=tomorrow",
    "?day=2026-02-31",
    "?day=2026-11-18x",
    "?d=2026-11-18",
  ])
    expect(dayFromSearch(search)).toBeNull();
});
