import { z } from "zod";

/**
 * One event of the Wix feed (`GET /_functions/appEvents`), as written by `toFeedEvent` in
 * `wix/backend/http-functions.js`. Contract: docs/architecture/wix-feed.md. Beside the
 * adapter, the only code that reads these shapes (D37); the contract package holds only the
 * feed's neutral envelope.
 *
 * Objects are loose: fields Wix or the feed add later are kept and never fail a parse.
 */

const Instant = z.iso.datetime({ offset: true });

export const WixCategory = z.looseObject({
  id: z.string().min(1),
  name: z.string().optional(),
  states: z.array(z.string()).optional(),
});
export type WixCategory = z.infer<typeof WixCategory>;

export const WixAddress = z.looseObject({
  formattedAddress: z.string().optional(),
  addressLine: z.string().optional(),
  addressLine2: z.string().optional(),
  streetAddress: z
    .looseObject({
      number: z.string().optional(),
      name: z.string().optional(),
      apt: z.string().optional(),
    })
    .optional(),
  city: z.string().optional(),
  /** `DC`, or ISO 3166-2 such as `US-DC`. */
  subdivision: z.string().optional(),
  postalCode: z.string().optional(),
  /** ISO 3166-1 alpha-2, such as `US`. */
  country: z.string().optional(),
  geocode: z.looseObject({ latitude: z.number(), longitude: z.number() }).optional(),
});
export type WixAddress = z.infer<typeof WixAddress>;

/** One event in the Wix Events V3 REST shape, limited to the fields the feed sends. */
export const WixEvent = z.looseObject({
  id: z.string().min(1),
  slug: z.string().optional(),
  title: z.string().optional(),
  /** `UPCOMING` or `STARTED`; kept as a string so a new value doesn't fail the parse. */
  status: z.string().optional(),
  shortDescription: z.string().optional(),
  /** Wix rich content (`{ nodes: [...] }`). */
  description: z.unknown().optional(),
  /** Mostly empty; the rich `description` holds the long text. */
  detailedDescription: z.string().optional(),
  location: z
    .looseObject({
      name: z.string().optional(),
      /** `VENUE` or `ONLINE`. */
      type: z.string().optional(),
      locationTbd: z.boolean().optional(),
      address: WixAddress.optional(),
    })
    .optional(),
  dateAndTimeSettings: z
    .looseObject({
      dateAndTimeTbd: z.boolean().optional(),
      /** Absent when the date is still to be decided. */
      startDate: Instant.optional(),
      endDate: Instant.optional(),
      timeZoneId: z.string().optional(),
      hideEndDate: z.boolean().optional(),
      recurrenceStatus: z.string().optional(),
      /** `categoryId` is shared by every event in a recurring series. */
      recurringEvents: z.looseObject({ categoryId: z.string().optional() }).optional(),
    })
    .optional(),
  mainImage: z.looseObject({ url: z.string().optional() }).optional(),
  eventPageUrl: z
    .looseObject({ base: z.string().optional(), path: z.string().optional() })
    .optional(),
  registration: z
    .looseObject({
      /** `RSVP`, `TICKETING`, `EXTERNAL` or `NONE`. */
      type: z.string().optional(),
      /** Open is `OPEN_TICKETS` or `OPEN_RSVP`; closed is `CLOSED_AUTOMATICALLY` and others (D24). */
      status: z.string().optional(),
      external: z.looseObject({ url: z.string().optional() }).optional(),
    })
    .optional(),
  categories: z.array(WixCategory).optional(),
  createdDate: Instant.optional(),
  updatedDate: Instant.optional(),
  /** When Wix published the event; the feed only sends published events. */
  publishedDate: Instant.optional(),
});
export type WixEvent = z.infer<typeof WixEvent>;
