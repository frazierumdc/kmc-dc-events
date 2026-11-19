// One check of the website per 5-second window (D28, D64), left by a Wix signal or the safety net.

import { getFunctions } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { checkTask } from "./check-website.ts";
import { REGION } from "./options.ts";

/** Leaves the check for this 5-second window, unless a signal or the timer already did. */
export async function queueCheck(from: string): Promise<void> {
  const task = checkTask(new Date());
  try {
    await getFunctions()
      .taskQueue(`locations/${REGION}/functions/checkWebsite`)
      .enqueue({}, { id: task.id, scheduleTime: task.scheduleTime });
    logger.info(`${from}: check ${task.id} at ${task.scheduleTime.toISOString()}`);
  } catch (error) {
    if ((error as { code?: string }).code !== "functions/task-already-exists") throw error;
  }
}
