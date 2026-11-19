import { describe, expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { adaptWixEvent, addressText, type AdaptResult } from "./wix-adapter.ts";

// Real events from the feed of 8 October 2026, trimmed (data-pipeline.md, step 2).

const HOSTS = ["www.example.org"];

function adapted(r: AdaptResult) {
  if (!r.ok) throw new Error(`expected a website event, got: ${r.reason}`);
  return r;
}
const adapt = (name: keyof typeof fixtures) => adapted(adaptWixEvent(fixtures[name], HOSTS));
const withChanges = (changes: Record<string, unknown>) =>
  adaptWixEvent({ ...fixtures["weekly-class"], ...changes }, HOSTS);

describe("real events", () => {
  test("weekly class: the website's categories without the series one, times in UTC", () => {
    const { event, warnings } = adapt("weekly-class");
    expect(warnings).toEqual([]);
    expect(event).toMatchObject({
      id: "4e19342f-344f-43e2-b641-676ce1a90a30",
      title: "Tuesday Rest and Reflect",
      start: "2026-10-13T22:00:00Z",
      end: "2026-10-13T22:30:00Z",
      categories: ["Weekly Meditation Classes"],
      location: {
        online: false,
        name: "Kadampa Meditation Center DC",
        address: "1200 Canal St SW, Washington, DC 20024, USA",
        city: "Washington",
        geo: { lat: 38.8762356, lng: -77.0117944 },
      },
      page: "https://www.example.org/event-details/tuesday-rest-and-reflect-2026-10-13-18-00",
      registrationOpen: true,
    });
    expect(event.summary).toBeTruthy();
    expect(event.description).toMatch(
      /^With Buddhist Teacher A\. Example\n\nEach session includes/,
    );
  });

  test("study program and prayer: registration closed in Wix, so More info (D36)", () => {
    const study = adapt("study-program").event;
    expect([study.categories, study.registrationOpen, study.description]).toEqual([
      ["Study Programs"],
      false,
      null,
    ]);
    expect(adapt("prayer").event.registrationOpen).toBe(false);
  });

  test("RSVP open is open", () => {
    expect(adapt("no-category").event.registrationOpen).toBe(true);
  });

  test("off-site special over several days: whitespace normalised, the city kept", () => {
    const { event } = adapt("special-offsite");
    expect(event).toMatchObject({
      title: "International Fall Festival",
      start: "2026-10-09T23:30:00Z",
      end: "2026-10-15T16:00:00Z",
      location: {
        address: "C. Cuarteles, 7, Distrito Centro, 29002 Málaga, Spain",
        city: "Málaga",
      },
    });
  });

  test("online: Wix's venue name kept, no address, city or map point; lists as lines", () => {
    const { event, warnings } = adapt("online");
    expect(warnings).toEqual([]);
    expect(event.title).toBe("Online: Silent Saturday: A Heart of Gratitude");
    expect(event.location).toEqual({
      online: true,
      name: "Online Conference",
      address: null,
      city: null,
      geo: null,
    });
    expect(event.description).toContain(
      "What to expect on retreat day:\n\n• Simple and profound guided meditations\n• Brief teachings",
    );
  });

  test("an online event and its in-person twin are both kept, as the website lists them", () => {
    expect(adapt("online-twin").event.location?.online).toBe(false);
  });

  test("Richmond: no summary; the city is Richmond", () => {
    const { event } = adapt("richmond");
    expect(event.summary).toBeNull();
    expect(event.location).toMatchObject({ name: "Diversity Thrift", city: "Richmond" });
  });

  test("no category, and two categories kept in the website's order", () => {
    expect(adapt("no-category").event.categories).toEqual([]);
    expect(adapt("two-kinds").event.categories).toEqual([
      "Chanted Prayers",
      "Retreats & Special Events",
    ]);
  });

  test("in person with an empty address: warned, no address, city or map point", () => {
    const { event, warnings } = adapt("empty-address");
    expect(event.location).toMatchObject({ online: false, address: null, city: null, geo: null });
    expect(warnings).toEqual(["in-person event without an address"]);
  });
});

describe("edge cases", () => {
  const dt = fixtures["weekly-class"].dateAndTimeSettings;

  test("an end equal to the start means no end", () => {
    const r = adapted(withChanges({ dateAndTimeSettings: { ...dt, endDate: dt.startDate } }));
    expect(r.event.end).toBeNull();
  });

  test("a date to be decided, or no start, is left out", () => {
    expect(withChanges({ dateAndTimeSettings: { ...dt, dateAndTimeTbd: true } })).toMatchObject({
      ok: false,
      reason: "date to be decided",
    });
    expect(withChanges({ dateAndTimeSettings: { timeZoneId: "America/New_York" } })).toMatchObject({
      ok: false,
      reason: "date to be decided",
    });
  });

  test("unpublished, ended or untitled events are left out (EV-1)", () => {
    expect(withChanges({ publishedDate: undefined })).toMatchObject({ reason: "not published" });
    expect(withChanges({ status: "ENDED" })).toMatchObject({ reason: "status ENDED" });
    expect(withChanges({ title: "  " })).toMatchObject({ reason: "no title" });
  });

  test("an unreadable event is left out with its id when it has one", () => {
    expect(adaptWixEvent({ id: "abc", title: 5 }, HOSTS)).toMatchObject({ ok: false, id: "abc" });
    expect(adaptWixEvent("nonsense", HOSTS)).toMatchObject({ ok: false, id: null });
  });

  test("an event with no page, or a page on a host not allowed, is left out (EV-6)", () => {
    expect(withChanges({ eventPageUrl: undefined })).toMatchObject({
      ok: false,
      reason: "no event page",
    });
    expect(
      withChanges({ eventPageUrl: { base: "https://tickets.example.com", path: "/e/1" } }),
    ).toMatchObject({
      ok: false,
      reason: "event page on a host not allowed: https://tickets.example.com/e/1",
    });
  });

  test("a time zone other than Eastern is warned about", () => {
    const r = adapted(withChanges({ dateAndTimeSettings: { ...dt, timeZoneId: "Europe/Madrid" } }));
    expect(r.warnings).toEqual(["time zone Europe/Madrid; times are shown in Eastern"]);
  });

  test("a place to be decided is no location", () => {
    const r = adapted(withChanges({ location: { locationTbd: true } }));
    expect(r.event.location).toBeNull();
  });

  test("the event's picture is the website's own, only from Wix's media server (slice 1.13)", () => {
    const url =
      "https://static.wixstatic.com/media/7399f8_97e14fcb0db643238b516beb9f20839f~mv2.jpg";
    expect(adapted(withChanges({ mainImage: { url } })).event.picture).toBe(url);
    expect(
      adapted(withChanges({ mainImage: { url: "https://example.com/a.jpg" } })).event.picture,
    ).toBeNull();
    expect(adapted(withChanges({ mainImage: undefined })).event.picture).toBeNull();
  });

  test("categories are de-duplicated, and nameless ones dropped", () => {
    const weekly = { id: "a", name: "Weekly Meditation Classes" };
    const r = adapted(withChanges({ categories: [weekly, weekly, { id: "b" }] }));
    expect(r.event.categories).toEqual(["Weekly Meditation Classes"]);
  });

  test("registration is open only for open tickets or RSVP", () => {
    for (const [status, open] of [
      ["OPEN_TICKETS", true],
      ["OPEN_RSVP", true],
      ["CLOSED_AUTOMATICALLY", false],
      ["CLOSED_MANUALLY", false],
    ] as const)
      expect(adapted(withChanges({ registration: { status } })).event.registrationOpen).toBe(open);
  });

  test("a long description is kept whole (D36)", () => {
    const text = "word ".repeat(2000).trim();
    const description = {
      nodes: [{ type: "PARAGRAPH", nodes: [{ type: "TEXT", textData: { text } }] }],
    };
    expect(adapted(withChanges({ description })).event.description).toBe(text);
  });

  test("a link on words gets its address after them (EV-33)", () => {
    expect(adapt("linked-description").event.description).toContain(
      "in the book Heart Jewel (https://tharpa.com/us/heart-jewel-393.html) by the tradition's",
    );
  });
});

test("an address is built from its parts when Wix has no formatted one", () => {
  expect(
    addressText({
      streetAddress: { number: "1407", name: "Sherwood Ave", apt: "" },
      city: "Richmond",
      subdivision: "US-VA",
      postalCode: "23220",
      country: "US",
    }),
  ).toBe("1407 Sherwood Ave, Richmond, VA 23220, USA");
  expect(addressText({ city: "Málaga", country: "ES" })).toBe("Málaga, Spain");
  expect(addressText({ formattedAddress: " ", city: "" })).toBeNull();
  expect(addressText(undefined)).toBeNull();
});
