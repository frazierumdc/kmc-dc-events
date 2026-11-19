// The update job's timer (D54): 4:07 AM and 4:07 PM Eastern.

import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { startJob } from "../jobs.ts";
import { timer, UPDATE_JOB } from "../options.ts";

export const startUpdateSchedule = onSchedule({ ...timer, schedule: "7 4,16 * * *" }, async () => {
  logger.info(`Started ${await startJob(UPDATE_JOB)}`);
});
