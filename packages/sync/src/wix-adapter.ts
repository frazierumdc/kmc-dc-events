import { isAllowedUrl, PictureUrl, TIME_ZONE, WebsiteEvent } from "@kmcdc/domain";
import { richTextToPlain } from "./rich-text.ts";
import { WixEvent, type WixAddress } from "./wix-event.ts";

/**
 * One Wix feed event → a website event (D37), or the reason it was left out. The only code
 * that knows Wix's shapes; the field table is in docs/architecture/data-pipeline.md, step 2.
 */

export type AdaptResult =
  | { ok: true; event: WebsiteEvent; warnings: string[] }
  | { ok: false; id: string | null; title: string | null; reason: string };

/** Wix registration statuses that mean "open" (D36). */
const OPEN_REGISTRATION = new Set(["OPEN_TICKETS", "OPEN_RSVP"]);

/** Statuses of a published event that hasn't ended (EV-1). */
const LISTED_STATUSES = new Set(["UPCOMING", "STARTED"]);

export function adaptWixEvent(raw: unknown, allowedHosts: readonly string[]): AdaptResult {
  const parsed = WixEvent.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return skip(rawId(raw), null, `unreadable: ${issue ? issueText(issue, " ") : ""}`);
  }
  const e = parsed.data;
  const title = normalizeSpace(e.title ?? "");
  const skipped = (reason: string) => skip(e.id, title || null, reason);

  const notListed = whyNotListed(e, title);
  if (notListed) return skipped(notListed);
  const page = eventPage(e.eventPageUrl);
  if (page === null) return skipped("no event page");
  if (!isAllowedUrl(page, allowedHosts))
    return skipped(`event page on a host not allowed: ${page}`);

  const { fields, warnings } = eventFields(e, title, page);
  const event = WebsiteEvent.safeParse(fields);
  if (!event.success) {
    const issue = event.error.issues[0];
    return skipped(`invalid ${issue ? issueText(issue, ": ") : "event"}`);
  }
  return { ok: true, event: event.data, warnings };
}

/** Every field of the website event, from the mappers below, and what they warn of. */
function eventFields(e: WixEvent, title: string, page: string) {
  const dt = e.dateAndTimeSettings;
  const where = eventLocation(e.location);
  const fields = {
    id: e.id,
    title,
    summary: nonEmpty(e.shortDescription),
    description: richTextToPlain(e.description, Infinity) || null,
    ...eventTimes(dt?.startDate ?? "", dt?.endDate),
    categories: eventCategories(e.categories, dt?.recurringEvents?.categoryId),
    location: where.location,
    page,
    registrationOpen: OPEN_REGISTRATION.has(e.registration?.status ?? ""),
    picture: eventPicture(e.mainImage?.url),
    // The website's own events; only other centers' (D67) are marked.
    otherCenter: undefined,
  } satisfies Record<keyof WebsiteEvent, unknown>;
  const warnings = [timeZoneWarning(dt?.timeZoneId), where.warning].filter((w) => w !== null);
  return { fields, warnings };
}

// The field mappers: one small pure function per part of an event, each with its own table
// test (wix-adapter-fields.test.ts).

/**
 * Why the app doesn't list an event, or null when it does: no title, a status other than
 * upcoming or started (EV-1), not published, or no date yet. The first that applies.
 */
export function whyNotListed(e: WixEvent, title: string): string | null {
  if (!title) return "no title";
  if (e.status !== undefined && !LISTED_STATUSES.has(e.status)) return `status ${e.status}`;
  if (!e.publishedDate) return "not published";
  const dt = e.dateAndTimeSettings;
  if (!dt?.startDate || dt.dateAndTimeTbd) return "date to be decided";
  return null;
}

/** Said of an event whose own time zone isn't Eastern (D8): its times are shown in Eastern all the same. */
export function timeZoneWarning(timeZoneId: string | undefined): string | null {
  return timeZoneId && timeZoneId !== TIME_ZONE
    ? `time zone ${timeZoneId}; times are shown in Eastern`
    : null;
}

/** The event's page on the website, from its base and path; null when either is missing. */
export function eventPage(url: WixEvent["eventPageUrl"]): string | null {
  return url?.base && url.path ? url.base.replace(/\/+$/, "") + url.path : null;
}

/** Start and end in whole seconds, UTC; no end when there is none or it equals the start. */
export function eventTimes(
  startDate: string,
  endDate: string | undefined,
): { start: string; end: string | null } {
  const start = utc(startDate);
  return { start, end: endDate && utc(endDate) !== start ? utc(endDate) : null };
}

/** The category names, tidied, each once, without the one Wix adds for a recurring series. */
export function eventCategories(
  categories: WixEvent["categories"],
  recurrenceId: string | undefined,
): string[] {
  const names = (categories ?? [])
    .filter((c) => c.id !== recurrenceId)
    .map((c) => normalizeSpace(c.name ?? ""))
    .filter(Boolean);
  return [...new Set(names)];
}

/**
 * Where the event is: null when Wix has no place or it is to be decided; online events have
 * no address, city or map point. Warns of an in-person event without an address.
 */
export function eventLocation(where: WixEvent["location"]): {
  location: WebsiteEvent["location"];
  warning: string | null;
} {
  if (!where || where.locationTbd === true) return { location: null, warning: null };
  const name = nonEmpty(where.name);
  if (where.type === "ONLINE")
    return {
      location: { online: true, name, address: null, city: null, geo: null },
      warning: null,
    };
  const address = addressText(where.address);
  const geocode = where.address?.geocode;
  return {
    location: {
      online: false,
      name,
      address,
      city: nonEmpty(where.address?.city),
      geo: geocode ? { lat: geocode.latitude, lng: geocode.longitude } : null,
    },
    warning: address === null ? "in-person event without an address" : null,
  };
}

/** The website's own picture of the event, only from Wix's media server (slice 1.13). */
export function eventPicture(url: string | undefined): string | null {
  return url !== undefined && PictureUrl.safeParse(url).success ? url : null;
}

/** The id of an event that can't be read, when it has one. */
function rawId(raw: unknown): string | null {
  return isRecord(raw) && typeof raw.id === "string" && raw.id ? raw.id : null;
}

/** A schema issue as text: where, and what. */
function issueText(issue: { path: PropertyKey[]; message: string }, between: string): string {
  return `${issue.path.join(".")}${between}${issue.message}`;
}

/** The address on one line: Wix's formatted address, else built from its parts. */
export function addressText(address: WixAddress | undefined): string | null {
  if (!address) return null;
  const formatted = normalizeSpace((address.formattedAddress ?? "").replace(/\n+/g, ", "));
  if (formatted) return formatted;
  const street =
    nonEmpty(address.addressLine) ??
    nonEmpty(
      [address.streetAddress?.number, address.streetAddress?.name].filter(Boolean).join(" "),
    );
  const region = address.subdivision?.replace(/^[A-Z]{2}-/, "");
  const parts = [
    street,
    nonEmpty(address.streetAddress?.apt),
    nonEmpty(address.addressLine2),
    nonEmpty(address.city),
    nonEmpty([region, address.postalCode].filter(Boolean).join(" ")),
    countryName(address.country),
  ];
  return nonEmpty(parts.filter(Boolean).join(", "));
}

const regions = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "US") return "USA";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/** `2026-10-07T23:00:00.773Z` → `2026-10-07T23:00:00Z`: whole seconds, UTC. */
function utc(instant: string): string {
  return new Date(instant).toISOString().slice(0, 19) + "Z";
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function nonEmpty(text: string | undefined): string | null {
  const t = normalizeSpace(text ?? "");
  return t || null;
}

function skip(id: string | null, title: string | null, reason: string): AdaptResult {
  return { ok: false, id, title, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
