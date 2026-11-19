// The reminders before an event (D69, NT-40 – NT-46): every 15 minutes, the reminders that
// came due in those 15 minutes, worked out from the schedule published on the stage's site
// and sent to the lists of the phones that follow each event. Nothing is kept: a run's 15
// minutes are fixed by the time it was due, so a run tried again sends the same reminders,
// and one message that fails is logged while the rest still go (NT-21).

import { eventRemindersDue, REMINDERS_EVERY_MS, type FcmSend } from "@kmcdc/domain";
import { publishedSchedule, publishedSnapshot, type PublishedOptions } from "./check-website.ts";

/** A run this late sends nothing: a reminder more than 3 hours after its time is dropped (NT-45). */
export const REMINDERS_LATE_MS = 3 * 60 * 60_000;

export interface RemindersOptions extends PublishedOptions {
  /** When the run was due: its reminders are those due in the 15 minutes up to it. */
  due: Date;
  /** Now, to tell a run that is tried again too late. */
  now: Date;
  send: (body: FcmSend) => Promise<string>;
  log: (line: string) => void;
}

/**
 * Sends the run's reminders; returns how many went. Throws only when the site won't give
 * its schedule, before anything is sent, so the run can safely be tried again.
 */
export async function sendReminders(options: RemindersOptions): Promise<number> {
  const { due, now, send, log } = options;
  if (now.getTime() - due.getTime() > REMINDERS_LATE_MS) {
    log(`Reminders: the run due at ${due.toISOString()} is more than 3 hours late; none sent.`);
    return 0;
  }
  const published = await publishedSchedule({ ...options, now });
  const schedule =
    published && (published.snapshot ?? (await publishedSnapshot(options, published.manifest)));
  if (!schedule) {
    log("Reminders: nothing is published on the site; none sent.");
    return 0;
  }
  const from = new Date(due.getTime() - REMINDERS_EVERY_MS);
  const reminders = eventRemindersDue(schedule, from, due);
  let sent = 0;
  for (const reminder of reminders) {
    const what = `${reminder.kind === "day" ? "Tomorrow" : "In a week"}: ${reminder.title} (${reminder.lists.join(", ")})`;
    try {
      await send(reminder.send);
      sent++;
      log(`Reminded ${what}`);
    } catch (error) {
      log(`Not reminded ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(
    `Reminders: ${String(sent)} of ${String(reminders.length)} sent for the 15 minutes to ${due.toISOString()}.`,
  );
  return sent;
}

/** The quarter hour a run was due at: the timer's own time, rounded down. */
export function quarterHour(scheduled: Date): Date {
  return new Date(Math.floor(scheduled.getTime() / REMINDERS_EVERY_MS) * REMINDERS_EVERY_MS);
}
