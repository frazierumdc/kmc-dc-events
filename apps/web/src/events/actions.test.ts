import type { SnapshotV2Event } from "@kmcdc/domain";
import { describe, expect, test } from "vitest";
import { calendarFiles, googleCalendarUrl, icsFile } from "@kmcdc/publish";
import { sheetActions, type Platform } from "./actions.ts";
import { golden, goldenEvent } from "../../test/schedule.ts";

const ORIGIN = "https://your-project-id-dev.web.app";
const rest = goldenEvent("Tuesday Rest and Reflect");
const actions = (e: SnapshotV2Event, platform: Platform = "ios") =>
  sheetActions(e, platform, ORIGIN);

describe("the main button (EV-35, D36)", () => {
  test("Register while registration is open, to the event's page", () => {
    expect(actions(rest).main).toEqual({ label: "Register", href: rest.page });
  });

  test("More info when registration is closed, to the same page", () => {
    const study = goldenEvent("The Foundation Program");
    expect(actions(study).main).toEqual({ label: "More info", href: study.page });
  });
});

describe("the online button (D46, EV-40)", () => {
  const livestream = {
    type: "livestream" as const,
    page: "https://www.example.org/online-classes",
  };
  const twin = (registrationOpen: boolean) => ({
    type: "event" as const,
    id: "online-1",
    page: "https://www.example.org/event-details/online-silent-saturday",
    registrationOpen,
  });

  test("none without an online option", () => {
    expect(actions(rest).online).toBeNull();
  });

  test("Join online to the online classes page; the main button says in person", () => {
    const a = actions({ ...rest, online: livestream });
    expect(a.main).toEqual({ label: "Register in person", href: rest.page });
    expect(a.online).toEqual({
      label: "Join online",
      href: livestream.page,
      caption: "Log in on the website to get the livestream link",
    });
  });

  test("Register online, or More info online, to the online event's page", () => {
    expect(actions({ ...rest, online: twin(true) }).online).toEqual({
      label: "Register online",
      href: twin(true).page,
      caption: null,
    });
    expect(actions({ ...rest, online: twin(false) }).online?.label).toBe("More info online");
    const study = goldenEvent("The Foundation Program", { online: twin(true) });
    expect(actions(study).main.label).toBe("More info");
  });

  test("the online icon alone adds no button and leaves Register as it is", () => {
    const festival = goldenEvent("International Fall Festival", {
      online: { type: "iconOnly" },
      registrationOpen: true,
    });
    const a = actions(festival);
    expect(a.online).toBeNull();
    expect(a.main).toEqual({ label: "Register", href: festival.page });
    const url = new URL(googleCalendarUrl(festival, `${ORIGIN}/e/${festival.id}`));
    expect(url.searchParams.get("details")).toBe(`${ORIGIN}/e/${festival.id}\n${festival.page}`);
  });

  test("calendar notes add the online page", () => {
    const url = new URL(
      googleCalendarUrl({ ...rest, online: livestream }, `${ORIGIN}/e/${rest.id}`),
    );
    expect(url.searchParams.get("details")).toBe(
      `${ORIGIN}/e/${rest.id}\n${rest.page}\nOnline: ${livestream.page}`,
    );
  });
});

describe("Directions", () => {
  const address = "1200%20Canal%20St%20SW%2C%20Washington%2C%20DC%2020024%2C%20USA";
  const apple = (to: string) => ({
    label: "Apple Maps",
    href: `https://maps.apple.com/directions?destination=${to}`,
    newView: true,
  });
  const google = (to: string) => ({
    label: "Google Maps",
    href: `https://www.google.com/maps/dir/?api=1&destination=${to}`,
    newView: true,
  });

  test("Apple Maps or Google Maps on iPhone, Google Maps alone on Android, to the address", () => {
    expect(actions(rest).directions).toEqual({
      label: "Directions",
      choices: [apple(address), google(address)],
    });
    expect(actions(rest, "android").directions).toEqual({
      label: "Directions",
      choices: [google(address)],
    });
  });

  test("by address alone, or by map point when there is no address", () => {
    const place = rest.location ?? null;
    if (!place) throw new Error("no place");
    expect(actions({ ...rest, location: { ...place, geo: null } }).directions?.choices).toEqual([
      apple(address),
      google(address),
    ]);
    const point = "38.8762356%2C-77.0117944";
    expect(actions({ ...rest, location: { ...place, address: null } }).directions?.choices).toEqual(
      [apple(point), google(point)],
    );
  });

  test("none for online events, or a place with no address or map point", () => {
    expect(
      actions(goldenEvent("Online: Silent Saturday: A Heart of Gratitude")).directions,
    ).toBeNull();
    expect(actions({ ...rest, location: null }).directions).toBeNull();
    const bare = { online: false, name: "Somewhere", address: null, city: null, geo: null };
    expect(actions({ ...rest, location: bare }).directions).toBeNull();
  });
});

describe("Add to calendar", () => {
  test("a calendar file on iPhone, in UTC, with a stable id and the event's link", () => {
    const ics = icsFile(rest, golden.snapshot, `${ORIGIN}/e/${rest.id}`);
    // No line over 75 bytes; a longer one goes on in lines starting with a space.
    const lines = ics.split("\r\n");
    expect(Math.max(...lines.map((l) => new TextEncoder().encode(l).length))).toBeLessThanOrEqual(
      75,
    );
    expect(ics.replace(/\r\n /g, "").split("\r\n")).toEqual(
      expect.arrayContaining([
        "BEGIN:VCALENDAR",
        `UID:${rest.id}@kmc-dc-events`,
        "DTSTART:20261013T220000Z",
        "DTEND:20261013T223000Z",
        "SUMMARY:Tuesday Rest and Reflect",
        "LOCATION:Kadampa Meditation Center DC\\, 1200 Canal St SW\\, Washington\\, DC 20024\\, USA",
        `URL:${ORIGIN}/e/${rest.id}`,
        "END:VCALENDAR",
      ]),
    );
    // The notes give the event in the app first, then its page on the website.
    expect(ics.replace(/\r\n /g, "")).toContain(
      `DESCRIPTION:${ORIGIN}/e/${rest.id}\\n${rest.page}`,
    );
  });

  test("on iPhone, a choice: Apple Calendar in the app's window, or Google Calendar", () => {
    const { label, choices } = actions(rest).calendar;
    expect(label).toBe("Add to calendar");
    expect(choices.map((c) => [c.label, c.newView])).toEqual([
      ["Apple Calendar", false],
      ["Google Calendar", true],
    ]);
    // A home-screen app opens the published file, not one made on the phone.
    expect(choices[0]?.href).toBe(`${ORIGIN}/v2/feed/calendar/${rest.id}.ics`);
    expect(choices[1]?.href).toBe(actions(rest, "android").calendar.choices[0]?.href);
  });

  test("an all-day event is whole days, the end being the day after", () => {
    const allDay = {
      ...rest,
      allDay: true,
      start: "2026-11-08T00:00:00-05:00",
      end: "2026-11-10T23:59:00-05:00",
    };
    const ics = icsFile(allDay, golden.snapshot, ORIGIN);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261108\r\nDTEND;VALUE=DATE:20261111");
    expect(googleCalendarUrl(allDay, ORIGIN)).toContain("dates=20261108%2F20261111");
  });

  test("each event's file is published beside the schedule, where iPhone's button opens", () => {
    const files = calendarFiles(golden.snapshot, ORIGIN);
    expect(files.size).toBe(golden.snapshot.events.length);
    const href = actions(rest).calendar.choices[0]?.href ?? "";
    expect(files.get(href.slice(`${ORIGIN}/v2/feed/`.length))).toBe(
      icsFile(rest, golden.snapshot, `${ORIGIN}/e/${rest.id}`),
    );
    const odd = { ...golden.snapshot, events: [{ ...rest, id: "../index" }] };
    expect(calendarFiles(odd, ORIGIN).size).toBe(0);
  });

  test("Google Calendar on Android, straight away, with the event's links in the details", () => {
    const { choices } = actions(rest, "android").calendar;
    expect(choices).toHaveLength(1);
    const url = new URL(choices[0]?.href ?? "");
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("text")).toBe("Tuesday Rest and Reflect");
    expect(url.searchParams.get("dates")).toBe("20261013T220000Z/20261013T223000Z");
    expect(url.searchParams.get("details")).toBe(`${ORIGIN}/e/${rest.id}\n${rest.page}`);
    expect(url.searchParams.get("ctz")).toBe("America/New_York");
  });
});

test("Share: the event's own address", () => {
  expect(actions(rest).share).toEqual({ url: `${ORIGIN}/e/${rest.id}` });
});
