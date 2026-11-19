import { z } from "zod";
import { Program } from "./programs.ts";
import { WEEKDAYS } from "./time.ts";

/**
 * The neutral website event (D37), the site settings and the schema 2 files phones
 * download. Nothing here knows Wix. The one piece of event information of the app's own is
 * the online schedule copied from the website's online classes page (D46). Explained in
 * docs/architecture/data-model.md.
 */

/** A UTC instant such as `2026-10-07T23:00:00Z`. */
export const UtcInstant = z.iso.datetime();

/** An instant with the Eastern offset, such as `2026-10-12T19:00:00-04:00`. */
const EasternInstant = z.iso.datetime({ offset: true });

const HttpsUrl = z.url({ protocol: /^https$/ });

/**
 * The event's picture: on the website, from Wix's media server (slice 1.13); for another
 * center's event, from its own site's (Squarespace's) image server (D67).
 */
export const PictureUrl = z.url({
  protocol: /^https$/,
  hostname: /^(static\.wixstatic\.com|images\.squarespace-cdn\.com)$/,
});

export const Geo = z.strictObject({ lat: z.number(), lng: z.number() });
export type Geo = z.infer<typeof Geo>;

/** Hosts allowed in event pages and links (EV-6). */
export const AllowedHosts = z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1);
export type AllowedHosts = z.infer<typeof AllowedHosts>;

/** True when `url` is https on one of `hosts`. */
export function isAllowedUrl(url: string, hosts: readonly string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && hosts.includes(u.hostname);
  } catch {
    return false;
  }
}

/** `c_` + 12 Crockford base32 characters: one class or program, derived from title and city (D39). */
export const ClassId = z.string().regex(/^c_[0-9A-HJKMNP-TV-Z]{12}$/);
export type ClassId = z.infer<typeof ClassId>;

// Snapshot readers drop fields they don't know, so the shapes phones read are plain
// objects; the adapter's output is checked strictly.

const location = {
  online: z.boolean(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  /** Rows show it when it isn't the home city (EV-11). */
  city: z.string().nullable(),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
};

const eventFields = {
  /** The source's own id (D39); links are `/e/{id}`. */
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  /** Plain text with paragraphs (C-6). */
  description: z.string().nullable(),
  /** The website's category names, in its order. */
  categories: z.array(z.string().min(1)),
  page: HttpsUrl,
  /** Register when open, otherwise More info (D36). */
  registrationOpen: z.boolean(),
};

/** What the adapter makes of one source event: what its page on the website shows. */
export const WebsiteEvent = z.strictObject({
  ...eventFields,
  /** The website's picture of the event; null when it has none. */
  picture: PictureUrl.nullable(),
  start: UtcInstant,
  /** Null when the source has no end, or one equal to the start. */
  end: UtcInstant.nullable(),
  /** Null when the website gives no place. */
  location: z.strictObject({ ...location, geo: Geo.nullable() }).nullable(),
  /** Another center's event the owner asked for (D67): its own colour, slate. */
  otherCenter: z.literal(true).optional(),
});
export type WebsiteEvent = z.infer<typeof WebsiteEvent>;

const siteFields = {
  center: z.object({ name: z.string().min(1), shortName: z.string().min(1) }),
  /** Rows show a city label only for events elsewhere (EV-11). */
  homeCity: z.string().min(1),
  contact: z.object({
    phoneDisplay: z.string().min(1),
    phoneE164: z.string().regex(/^\+\d{8,15}$/),
    email: z.email(),
  }),
  links: z.object({ onlineClasses: HttpsUrl }),
};

/**
 * The membership card at the end of the list (EV-17): words copied from the website's
 * pricing plans page, and a link to it. No prices: they change on the website.
 */
export const Membership = z.object({
  title: z.string().min(1),
  intro: z.string().min(1),
  /** What most plans include, each a few words. */
  benefits: z.array(z.string().min(1)).min(1).max(3),
  /** Shown small under the button. */
  note: z.string().min(1),
  link: HttpsUrl,
});
export type Membership = z.infer<typeof Membership>;

/** An event's kind (D45): it gives the event its colour and its place in the filter. */
export const EventKind = z.enum(["class", "special", "prayer"]);
export type EventKind = z.infer<typeof EventKind>;

/** Each website category's kind; a category not listed has none (D45). */
export const CategoryKinds = z.record(z.string().min(1), EventKind);
export type CategoryKinds = z.infer<typeof CategoryKinds>;

/** An event with several categories takes the first of these that one of them maps to. */
const KIND_ORDER: readonly EventKind[] = ["special", "class", "prayer"];

/** The event's kind from its website categories, or null when none has one (D45). */
export function eventKind(
  categories: readonly string[],
  categoryKinds: CategoryKinds,
): EventKind | null {
  const kinds = new Set(categories.map((c) => categoryKinds[c]));
  return KIND_ORDER.find((k) => kinds.has(k)) ?? null;
}

/**
 * A special event the website also lists as a class (D45): one of its categories is a special
 * events' and another a class's, as a special event held in a weekly class's time. It keeps
 * its special colour, and is also under Classes.
 */
export function alsoAClass(categories: readonly string[], categoryKinds: CategoryKinds): boolean {
  return (
    eventKind(categories, categoryKinds) === "special" &&
    categories.some((c) => categoryKinds[c] === "class")
  );
}

/** `19:00`: a time of day in Eastern time, 24-hour. */
const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/**
 * A website category whose events at the center are livestreamed (D46): all of them, or
 * only those starting at one of `times`, never those titled as in `except`.
 */
export const Livestream = z.strictObject({
  category: z.string().min(1),
  /** Eastern weekday and start time, as the online classes page lists them. */
  times: z
    .array(z.strictObject({ day: z.enum(WEEKDAYS), start: TimeOfDay }))
    .min(1)
    .optional(),
  /** Titles, as the website has them, that aren't livestreamed. */
  except: z.array(z.string().min(1)).optional(),
});
export type Livestream = z.infer<typeof Livestream>;

/**
 * Events in a website category whose title has `titleWord` as a word, wherever they are
 * held, that the list marks as also online, with no link (D46).
 */
export const IconOnly = z.strictObject({
  category: z.string().min(1),
  titleWord: z.string().regex(/^[A-Za-z0-9]+$/),
});
export type IconOnly = z.infer<typeof IconOnly>;

/** The website's online classes page, copied by hand, and the events marked online (D46). */
export const OnlineSchedule = z.strictObject({
  livestreams: z.array(Livestream),
  iconOnly: z.array(IconOnly).default([]),
});
export type OnlineSchedule = z.infer<typeof OnlineSchedule>;

/** A prayer's short name in the KMC DC Events calendar and its key, for titles that start so (AN-14). */
export const PrayerName = z.strictObject({
  code: z.string().regex(/^[A-Za-z0-9]{1,4}$/),
  name: z.string().min(1),
  startsWith: z.string().min(1),
});
export type PrayerName = z.infer<typeof PrayerName>;

/** A class's or special event's one-word label in the calendar, for titles that start so (AN-14). */
export const SpecialLabel = z.strictObject({
  label: z.string().regex(/^\S{1,10}$/),
  startsWith: z.string().min(1),
});
export type SpecialLabel = z.infer<typeof SpecialLabel>;

/** The short names the KMC DC Events calendar uses, kept by hand (AN-14). */
export const EmailNames = z.strictObject({
  prayers: z.array(PrayerName).default([]),
  classes: z.array(SpecialLabel).default([]),
  special: z.array(SpecialLabel).default([]),
});
export type EmailNames = z.infer<typeof EmailNames>;

/**
 * An event at another center, copied by hand from its own page on that center's website, only
 * when the owner asks (D67). It is listed as the website's events are, its Register button
 * opening that page; it isn't updated by itself, and drops off once it is over.
 */
export const OtherCenterEvent = z.strictObject({
  /** Its id in the app: links are `/e/{id}`. */
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().min(1),
  /** Plain text with paragraphs, from its page. */
  description: z.string().min(1),
  /** A category in `categoryKinds`, for its kind and colour (D45). */
  categories: z.array(z.string().min(1)).min(1),
  /** Its page on the other center's website: Register opens it. */
  page: HttpsUrl,
  picture: PictureUrl.nullable(),
  /** Eastern, with its offset: `2026-12-05T10:00:00-05:00`. */
  start: EasternInstant,
  end: EasternInstant,
  location: z.strictObject({
    name: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
  }),
});
export type OtherCenterEvent = z.infer<typeof OtherCenterEvent>;

/** `data/site.json`: the center and its website, the online schedule (D46) and other centers' events (D67). */
export const SiteSettings = z
  .strictObject({
    ...siteFields,
    categoryKinds: CategoryKinds,
    allowedHosts: AllowedHosts,
    online: OnlineSchedule.default({ livestreams: [], iconOnly: [] }),
    membership: Membership.strict().nullable().default(null),
    /** The study programs whose members get their dates (AN-15). */
    programs: z.array(Program).default([]),
    emailNames: EmailNames.default({ prayers: [], classes: [], special: [] }),
    otherCenterEvents: z.array(OtherCenterEvent).default([]),
  })
  .superRefine((s, ctx) => {
    s.otherCenterEvents.forEach((e, i) => {
      if (!isAllowedUrl(e.page, s.allowedHosts))
        ctx.addIssue({
          code: "custom",
          path: ["otherCenterEvents", i, "page"],
          message: `not on an allowed host: ${e.page}`,
        });
      e.categories.forEach((c, j) => {
        if (!(c in s.categoryKinds))
          ctx.addIssue({
            code: "custom",
            path: ["otherCenterEvents", i, "categories", j],
            message: `not a category in categoryKinds: ${c}`,
          });
      });
      if (Date.parse(e.end) <= Date.parse(e.start))
        ctx.addIssue({
          code: "custom",
          path: ["otherCenterEvents", i, "end"],
          message: "ends before it starts",
        });
    });
    for (const [key, url] of Object.entries(s.links))
      if (!isAllowedUrl(url, s.allowedHosts))
        ctx.addIssue({
          code: "custom",
          path: ["links", key],
          message: `not on an allowed host: ${url}`,
        });
    if (s.membership && !isAllowedUrl(s.membership.link, s.allowedHosts))
      ctx.addIssue({
        code: "custom",
        path: ["membership", "link"],
        message: `not on an allowed host: ${s.membership.link}`,
      });
    s.programs.forEach((program, i) => {
      if (!(program.category in s.categoryKinds))
        ctx.addIssue({
          code: "custom",
          path: ["programs", i, "category"],
          message: `not a category in categoryKinds: ${program.category}`,
        });
    });
    for (const list of ["livestreams", "iconOnly"] as const)
      s.online[list].forEach((l, i) => {
        if (!(l.category in s.categoryKinds))
          ctx.addIssue({
            code: "custom",
            path: ["online", list, i, "category"],
            message: `not a category in categoryKinds: ${l.category}`,
          });
      });
  });
export type SiteSettings = z.infer<typeof SiteSettings>;

/**
 * How phones pick out a study program's sessions, for its own colour (AN-15, D45): the
 * program's id, short name, category and titles from `programs` in `data/site.json`.
 */
export const ProgramMatch = z.object({
  id: z.enum(["fp", "ttp"]),
  shortName: z.string().min(1),
  category: z.string().min(1),
  titles: z.array(z.string().min(1)).min(1),
});
export type ProgramMatch = z.infer<typeof ProgramMatch>;

/**
 * The site settings as phones read them: everything but `allowedHosts`, `online` and
 * `emailNames`, and of `programs` only what picks a program's sessions out. A schedule
 * published before `categoryKinds`, `membership` or `programs` existed reads as having none.
 */
export const PublishedSite = z.object({
  ...siteFields,
  categoryKinds: CategoryKinds.default({}),
  membership: Membership.nullable().default(null).catch(null),
  programs: z.array(ProgramMatch).default([]).catch([]),
});
export type PublishedSite = z.infer<typeof PublishedSite>;

/** `<UTC time>-<first 8 hex of sha256>`, such as `20261009T103112Z-3fa9c2d1`. */
export const SnapshotVersion = z.string().regex(/^\d{8}T\d{6}Z-[0-9a-f]{8}$/);

/**
 * How to take part online (D46): the center's livestream, whose links are on the online
 * classes page, the website's separate online event for it, or only the list's online icon.
 */
export const OnlineOption = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("livestream"),
    /** The online classes page (`site.links.onlineClasses`). */
    page: HttpsUrl,
  }),
  z.object({
    type: z.literal("event"),
    /** The online event's own id; `/e/{id}` opens the event it belongs to. */
    id: z.string().min(1),
    page: HttpsUrl,
    registrationOpen: z.boolean(),
  }),
  /** The list shows the online icon; the details panel has no online button. */
  z.object({ type: z.literal("iconOnly") }),
]);
export type OnlineOption = z.infer<typeof OnlineOption>;

export const SnapshotV2Event = z.object({
  ...eventFields,
  /** The website's picture of the event; null when it has none, or in an older schedule. */
  picture: PictureUrl.nullable().default(null).catch(null),
  /** Null when there is none; an option this app doesn't know reads as none. */
  online: OnlineOption.nullable().default(null).catch(null),
  /** What a favorite keeps. */
  classId: ClassId,
  start: EasternInstant,
  end: EasternInstant.nullable(),
  /** Starts at midnight Eastern and ends at midnight or 11:59 PM. */
  allDay: z.boolean(),
  location: z.object(location).nullable(),
  /** Another center's event (D67); absent for the website's own. */
  otherCenter: z.literal(true).optional().catch(undefined),
});
export type SnapshotV2Event = z.infer<typeof SnapshotV2Event>;

/** `/v2/feed/snapshots/<version>.json` and `/v2/feed/latest.json`. */
export const SnapshotV2 = z.object({
  schema: z.literal(2),
  version: SnapshotVersion,
  publishedAt: UtcInstant,
  timezone: z.literal("America/New_York"),
  site: PublishedSite,
  /** From the start of today (Eastern) to 400 days ahead, in start order. */
  events: z.array(SnapshotV2Event),
  /**
   * The featured events' ids, in the owner's order, shown as stories on the splash (EV-44);
   * from `featured.json` in the stage's bucket. Absent when none.
   */
  featured: z.array(z.string().min(1)).optional().catch(undefined),
});
export type SnapshotV2 = z.infer<typeof SnapshotV2>;

/**
 * `featured.json` in the stage's Cloud Storage bucket (EV-44): the featured events' pages,
 * as the website links them, in the order their stories show. Kept as simple as can be.
 */
export const FeaturedFile = z.object({ featured: z.array(z.string()) });
export type FeaturedFile = z.infer<typeof FeaturedFile>;

/** A page address as compared: no query, hash or trailing slash; the host in lower case. */
export function samePage(a: string, b: string): boolean {
  const key = (url: string) => {
    try {
      const u = new URL(url.trim());
      return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return url.trim();
    }
  };
  return key(a) === key(b);
}

/** `/v2/feed/manifest.json`. */
export const ManifestV2 = z.object({
  schema: z.literal(2),
  version: SnapshotVersion,
  /** Shown as "Schedule updated …". */
  publishedAt: UtcInstant,
  /** Snapshot path by schema number. */
  snapshots: z.object({ "2": z.string().regex(/^\/v2\/feed\/snapshots\/[^/]+\.json$/) }),
  /**
   * A fingerprint of which events are listed and when (each id, start and end): the Wix
   * signal's check compares it with the website now (D64). Missing from schedules published
   * before it existed.
   */
  schedule: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .optional(),
  /** Reserved: force old app builds to update. */
  minAppBuild: z.string().nullable(),
  /** Reserved. */
  message: z.string().nullable(),
});
export type ManifestV2 = z.infer<typeof ManifestV2>;
