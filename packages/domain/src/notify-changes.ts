// What to send after a publish (D65, NT-11 – NT-16): one notification per event that was
// cancelled or whose date or time changed, compared with the schedule published before.
// Nothing for a new event, a title, a description, a picture or a place (NT-11). Pure.

import { dayAddress } from "./day-address.ts";
import { eventWhen } from "./event-text.ts";
import { fcmSend, type FcmSend } from "./notify-message.ts";
import { classList, eventList, programList, type NotifyList } from "./notify-lists.ts";
import { eventProgram } from "./programs.ts";
import { scheduleChanges } from "./schedule-changes.ts";
import type { SnapshotV2, SnapshotV2Event } from "./website.ts";

/**
 * More notifications than this from one publish send none: so many changes at once more
 * likely mean the website was read short than that the center cancelled them all, and a
 * burst of false "Cancelled" would reach every phone (owner to confirm the number).
 */
export const MAX_NOTICES = 10;

/** One notification, ready to send, and what it is about for the run's log. */
export interface Notice {
  kind: "cancelled" | "moved";
  eventId: string;
  title: string;
  lists: NotifyList[];
  send: FcmSend;
}

const when = (event: SnapshotV2Event) => eventWhen(event, { zone: "Eastern" });

/**
 * The notifications for `after` over `before`: an event taken off the website before it
 * started is "Cancelled: {title}"; one whose date or time changed and still starts after
 * `now` is "New time: {title}", with the new time and the old. Each goes once to the event's
 * own list, its class's (a weekly class or other series) and, for a study program's session,
 * its program's (NT-13). It waits for a
 * phone that is off until the event starts (NT-16). None when nothing was published before.
 */
export function notifyChanges(before: SnapshotV2 | null, after: SnapshotV2, now: Date): Notice[] {
  if (before === null) return [];
  const changes = scheduleChanges(before, after, now);
  const lists = (event: SnapshotV2Event): NotifyList[] => {
    const program = eventProgram(event, after.site.programs);
    return [
      classList(event.classId),
      eventList(event.id),
      ...(program ? [programList(program.id)] : []),
    ];
  };
  const notices: Notice[] = [];
  for (const event of changes.removed) {
    if (Date.parse(event.start) <= now.getTime()) continue;
    const to = lists(event);
    notices.push({
      kind: "cancelled",
      eventId: event.id,
      title: event.title,
      lists: to,
      send: fcmSend(
        to,
        // Tapping opens the list at the date it was on (NT-15).
        {
          title: `Cancelled: ${event.title}`,
          body: when(event),
          url: dayAddress(event.start),
          tag: event.id,
        },
        new Date(event.start),
        now,
      ),
    });
  }
  for (const { before: was, after: event } of changes.moved) {
    if (Date.parse(event.start) <= now.getTime()) continue;
    const to = lists(event);
    notices.push({
      kind: "moved",
      eventId: event.id,
      title: event.title,
      lists: to,
      send: fcmSend(
        to,
        {
          title: `New time: ${event.title}`,
          body: `Now ${when(event)}. Was ${when(was)}.`,
          // Tapping opens the list at its new date, not the event (NT-15).
          url: dayAddress(event.start),
          tag: event.id,
        },
        new Date(event.start),
        now,
      ),
    });
  }
  return notices;
}
