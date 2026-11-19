import { z } from "zod";

/**
 * The envelope of a read of the website's events: when it was read, the window it covers and
 * the events as the source sent them. Contract: docs/architecture/wix-feed.md.
 *
 * It names no source: `events` stays `unknown[]`, and only the adapter's package
 * (packages/sync) knows an event's shape, parses each on its own and so never lets one
 * unreadable event fail the whole read. Objects are loose: fields added later are kept.
 */

const Instant = z.iso.datetime({ offset: true });

/** How the feed read events: as a site visitor, or with elevated permissions as a fallback. */
export const FeedAccess = z.enum(["visitor", "elevated"]);
export type FeedAccess = z.infer<typeof FeedAccess>;

export const FeedEnvelope = z.looseObject({
  generatedAt: Instant,
  /** Events ending after `from` and starting before `to` (yesterday to 400 days ahead). */
  window: z.looseObject({ from: Instant, to: Instant }),
  access: FeedAccess,
  count: z.number().int().nonnegative(),
  events: z.array(z.unknown()),
});
export type FeedEnvelope = z.infer<typeof FeedEnvelope>;
