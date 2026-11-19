// The safety net's timer (NT-7, D64).

import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION, wixSignalAccount } from "../options.ts";
import { queueCheck } from "../queue-check.ts";

/**
 * The safety net (NT-7, D64): every 5 minutes, the same check a Wix signal starts, so a lost
 * signal, a failed start or a failed publish is put right without anyone noticing.
 */
export const startCheck = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "America/New_York",
    region: REGION,
    serviceAccount: wixSignalAccount,
    retryCount: 1,
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 1,
  },
  async () => {
    await queueCheck("Safety net");
  },
);
