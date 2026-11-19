// The reminders before an event (D69, slice 1.16).

import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { accessToken, MESSAGING_SCOPE, sendMessage } from "@kmcdc/cloud";
import { config, PROJECT, REGION, serviceAccount, SITE } from "../options.ts";
import { quarterHour, REMINDERS_LATE_MS, sendReminders } from "../reminders.ts";

/**
 * The reminders before an event (D69, NT-40 – NT-46): every 15 minutes, those that came due
 * in the 15 minutes up to the run's own time, from the schedule published on the stage's
 * site, to the lists of the phones that follow each event. As notify-lists@, which may send
 * through the messaging service and nothing else. Pausing its timer in Cloud Scheduler turns reminders off
 * for the stage, and resuming it turns them on again (NT-50). A run that can't read the
 * schedule is tried again for up to 3 hours; later than that it sends nothing (NT-45).
 */
export const sendEventReminders = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "America/New_York",
    region: REGION,
    serviceAccount: serviceAccount("notify-lists"),
    retryCount: 5,
    minBackoffSeconds: 60,
    maxBackoffSeconds: 30 * 60,
    maxRetrySeconds: REMINDERS_LATE_MS / 1000,
    timeoutSeconds: 120,
    memory: "256MiB",
    maxInstances: 1,
  },
  async (event) => {
    await sendReminders({
      site: SITE,
      due: quarterHour(new Date(event.scheduleTime)),
      now: new Date(),
      send: (body) =>
        sendMessage({
          project: PROJECT,
          body,
          token: () => accessToken(config.env, fetch, [MESSAGING_SCOPE]),
        }),
      log: (line) => {
        logger.info(line);
      },
    });
  },
);
