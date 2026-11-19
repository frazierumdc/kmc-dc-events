import { expect, test } from "vitest";
import { parseMailSettings } from "./mail-settings.ts";

const ALL = {
  scheduleChanges: true,
  duplicates: true,
  events: true,
  programs: true,
  reminders: true,
};

test("unset: every email on, no warning (AN-17)", () => {
  expect(parseMailSettings(undefined)).toEqual({ settings: ALL, warning: null });
});

test("one switched off; the rest default to on", () => {
  expect(parseMailSettings('{"events": false}').settings).toEqual({ ...ALL, events: false });
});

test("the switches of Prayers and Special events are read and ignored (AN-14, AN-17)", () => {
  expect(
    parseMailSettings('{"prayers": false, "specialEvents": false, "prayersSpecial": false}'),
  ).toEqual({ settings: ALL, warning: null });
});

test("invalid or not JSON: every email on, with a warning", () => {
  expect(parseMailSettings('{"weekly": {"day": "monday"}}')).toEqual({
    settings: ALL,
    warning: expect.stringContaining("MAIL_SETTINGS is invalid") as unknown,
  });
  expect(parseMailSettings("{").warning).toContain("isn't JSON");
});
