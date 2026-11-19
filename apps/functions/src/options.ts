// What the functions share: their secrets and parameters, the deployment they run in
// (config.ts), the job names, and the options both timers and the Wix signal's functions take.

import { defineSecret, defineString } from "firebase-functions/params";
import type { ScheduleOptions } from "firebase-functions/v2/scheduler";
import { SEND_EMAIL_JOB, UPDATE_SCHEDULE_JOB } from "@kmcdc/cloud";
import { functionsConfig } from "./config.ts";

export const feedToken = defineSecret("WIX_FEED_TOKEN");
export const signalSecret = defineSecret("WIX_SIGNAL_SECRET");

/** The project Firebase runs these in, its region, site and accounts (config.ts). */
export const config = functionsConfig();
export const { project: PROJECT, region: REGION, site: SITE, serviceAccount } = config;

/**
 * The stage these functions run for, `dev`, `test` or `prod`, named in the check's log lines:
 * a setting, not code (D57). Deploy functions writes it.
 */
export const stage = defineString("STAGE");
/**
 * The stage's two Cloud Run jobs (D63, ADR 0017): Update schedule and Send email run only
 * there, started through Google's own API.
 */
export const UPDATE_JOB = UPDATE_SCHEDULE_JOB;
export const EMAIL_JOB = SEND_EMAIL_JOB;

/** What both timers share. */
export const timer: Omit<ScheduleOptions, "schedule"> = {
  timeZone: "America/New_York",
  region: REGION,
  // Its own account, which may only start the stage's jobs (scripts/setup-update-job.sh).
  // In full: the Firebase CLI doesn't expand "schedule-timer@" when it checks the secret.
  serviceAccount: serviceAccount("schedule-timer"),
  retryCount: 3,
  minBackoffSeconds: 60,
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 1,
};

/** The Wix signal's own account (D28): reads its two secrets and enqueues its checks. */
export const wixSignalAccount = serviceAccount("wix-signal");
