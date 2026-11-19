// Sends the notifications a copy found (D65, NT-11 – NT-16), right after its publish: one
// message per cancelled or moved event. A message that fails is said in the run's log and
// the rest still go; the run itself never fails for it, as the schedule is the record (NT-21).

import { MAX_NOTICES, type FcmSend, type Notice } from "@kmcdc/domain";

/** Sends the notices; returns how many went. More than MAX_NOTICES at once send none. */
export async function sendNotices(
  notices: readonly Notice[],
  send: (body: FcmSend) => Promise<string>,
  log: (line: string) => void,
): Promise<number> {
  if (notices.length === 0) return 0;
  if (notices.length > MAX_NOTICES) {
    log(
      `Notifications: ${String(notices.length)} cancelled or moved events at once, more than ${String(MAX_NOTICES)}; none sent, in case the website was read short.`,
    );
    return 0;
  }
  let sent = 0;
  for (const notice of notices) {
    const what = `${notice.kind === "cancelled" ? "Cancelled" : "New time"}: ${notice.title} (${notice.lists.join(", ")})`;
    try {
      await send(notice.send);
      sent++;
      log(`Notified ${what}`);
    } catch (error) {
      log(`Not notified ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return sent;
}
