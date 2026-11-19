// KMC DC Events' timer (AN-14, D51).

import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { startJob } from "../jobs.ts";
import { EMAIL_JOB, timer } from "../options.ts";

/**
 * KMC DC Events at 4:30 AM on Mondays, Wednesdays and Fridays (AN-14, D51): Send email with
 * `scheduled`, which sends it once that day, when switched on, from the last copy.
 */
export const startEventsEmail = onSchedule({ ...timer, schedule: "30 4 * * 1,3,5" }, async () => {
  const run = await startJob(EMAIL_JOB, { EMAIL: "events", TO: "list", SCHEDULED: "true" });
  logger.info(`Started ${run} (KMC DC Events)`);
});
