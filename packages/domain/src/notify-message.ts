// A notification as Firebase Cloud Messaging sends it to one list (D65, NT-14 – NT-16): data
// only, so the app's service worker draws it the same way on every phone
// (apps/web/public/push-sw.js). Pure.

import type { NotifyList } from "./notify-lists.ts";

/** What the phone shows, and where tapping it goes. */
export interface PushNote {
  /** "Cancelled: {title}" or "New time: {title}" (NT-15). */
  title: string;
  body: string;
  /** A path on the app's own site, such as `/e/{id}` (EV-37). */
  url: string;
  /** The event's id: a later change to it replaces this one on the lock screen (NT-14). */
  tag: string;
}

/** FCM's HTTP v1 `messages:send` body: to one list, or to any of several as one condition. */
export interface FcmSend {
  message: ({ topic: NotifyList } | { condition: string }) & {
    webpush: { headers: { TTL: string; Urgency: "high" }; data: Record<string, string> };
  };
}

/** The most lists one condition may name (Firebase's own limit). */
export const MAX_CONDITION_LISTS = 5;

/** The longest a message waits for a phone that is off: 4 weeks, web push's own limit. */
export const MAX_TTL_SECONDS = 28 * 24 * 60 * 60;

/**
 * One message to one list, or to any of several lists as one condition, so a phone on two of
 * them gets it once (NT-14). It waits for a phone that is off until `expiresAt` (the event's
 * start, NT-16), at least a minute and at most web push's 4 weeks.
 */
export function fcmSend(
  to: NotifyList | readonly NotifyList[],
  note: PushNote,
  expiresAt: Date,
  now: Date,
): FcmSend {
  const seconds = Math.round((expiresAt.getTime() - now.getTime()) / 1000);
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(60, seconds));
  if (typeof to !== "string" && (to.length === 0 || to.length > MAX_CONDITION_LISTS))
    throw new Error(
      `A message goes to 1 – ${String(MAX_CONDITION_LISTS)} lists, not ${String(to.length)}`,
    );
  const target =
    typeof to === "string"
      ? { topic: to }
      : to.length === 1
        ? { topic: to[0] as NotifyList }
        : { condition: to.map((list) => `'${list}' in topics`).join(" || ") };
  return {
    message: {
      ...target,
      webpush: {
        headers: { TTL: String(ttl), Urgency: "high" },
        data: { title: note.title, body: note.body, url: note.url, tag: note.tag },
      },
    },
  };
}
