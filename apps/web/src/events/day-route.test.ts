import { expect, test } from "vitest";
import { takeArrivalDay } from "./day-route.ts";

// A notification opens the list at a date (NT-15): the app reads it once and tidies the address.
function at(search: string) {
  const replaced: string[] = [];
  const history = {
    state: null,
    replaceState: (_state: unknown, _title: string, url?: string | URL | null) => {
      replaced.push(String(url));
    },
  };
  return { day: takeArrivalDay({ pathname: "/", search, hash: "" }, history), replaced };
}

test("the date is taken from the address, which is then the list's own", () => {
  expect(at("?day=2026-11-18")).toEqual({ day: "2026-11-18", replaced: ["/"] });
});

test("an address without a date is left alone; a bad date is only removed", () => {
  expect(at("")).toEqual({ day: null, replaced: [] });
  expect(at("?day=soon")).toEqual({ day: null, replaced: ["/"] });
});
