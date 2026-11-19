// The check of the website against the published schedule (D64), and its alarm (NT-8).

import { logger } from "firebase-functions";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import site from "../../../../data/site.json" with { type: "json" };
import { SiteSettings } from "@kmcdc/domain";
import { fetchFeed } from "@kmcdc/sync";
import {
  alarmEmail,
  behindMessage,
  behindSince,
  checkMessage,
  EMAIL_EVERY_MS,
  GUARD_MS,
  mayStart,
  publishedSchedule,
  publishedSnapshot,
  runKey,
  scheduleCheck,
  type Published,
} from "../check-website.ts";
import { googleRuns, startJob } from "../jobs.ts";
import {
  EMAIL_JOB,
  feedToken,
  REGION,
  SITE,
  stage as stageSetting,
  UPDATE_JOB,
  wixSignalAccount,
} from "../options.ts";

/**
 * A few minutes after a signal: the website now, compared with the schedule published on the
 * site (D64); starts the update job only when the schedule changed.
 */
export const checkWebsite = onTaskDispatched(
  {
    region: REGION,
    secrets: [feedToken],
    serviceAccount: wixSignalAccount,
    invoker: [wixSignalAccount],
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 1 },
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async () => {
    const stage = stageSetting.value();
    const now = new Date();
    const feed = await fetchFeed({ token: feedToken.value() });
    const settings = SiteSettings.parse(site);
    // The site failing to answer mustn't hold a change back until the timer's next run: the
    // update job decides instead.
    let published: Published | null | "unreadable";
    try {
      published = await publishedSchedule({ site: SITE, now });
    } catch (error) {
      logger.warn(`Site unreadable: ${error instanceof Error ? error.message : String(error)}`);
      published = "unreadable";
    }
    let check = scheduleCheck(published, feed, settings, now);
    // For the log: how the schedules differ, from the whole published schedule.
    if (
      check.changed &&
      !check.notCompared &&
      !check.counts &&
      published &&
      published !== "unreadable"
    ) {
      const snapshot = await publishedSnapshot({ site: SITE }, published.manifest).catch(
        () => null,
      );
      if (snapshot) check = scheduleCheck({ ...published, snapshot }, feed, settings, now);
    }
    if (!check.changed) {
      logger.info(checkMessage(check, stage));
      await alarm(stage, now, null);
      return;
    }
    // At most three copies for one state of the website (mayStart): a disagreement between
    // the check and the copy must never start a copy every 5 minutes.
    const key = runKey(check);
    const guardSince = new Date(now.getTime() - GUARD_MS);
    const runs = await googleRuns(UPDATE_JOB, guardSince);
    const start = mayStart(runs, key);
    if (start === "start") {
      await startJob(UPDATE_JOB, { TRIGGER: "wix", FINGERPRINT: key });
      logger.info(checkMessage(check, stage));
    } else if (start === "running") logger.info(checkMessage(check, stage, start));
    else logger.error(checkMessage(check, stage, start));
    // Never silently behind (NT-8): 15 minutes after the first copy for this state of the
    // website started, a person is told.
    const since = behindSince(runs, key, now);
    if (since) {
      logger.error(behindMessage(since));
      await alarm(stage, now, since);
    }
  },
);

/**
 * The Problem email's side of the alarm (NT-8): starts Send email with "behind" once a day
 * while the site is behind, and with "working" once it matches again. It never fails the
 * check: Cloud Monitoring's alerts, read from the check's log, don't depend on it. Each
 * finished check logs exactly one line starting "Check: ", which the alert for checks that
 * stopped counts (scripts/setup-delivery-alerts.sh).
 */
async function alarm(stage: string, now: Date, since: Date | null): Promise<void> {
  try {
    const alarmSince = new Date(now.getTime() - EMAIL_EVERY_MS - 60 * 60_000);
    const mailRuns = await googleRuns(EMAIL_JOB, alarmSince);
    const email = alarmEmail(mailRuns, since !== null, now);
    if (!email) return;
    await startJob(EMAIL_JOB, {
      EMAIL: email,
      TO: "list",
      ...(since ? { SINCE: since.toISOString() } : {}),
    });
    logger.info(`Alarm: started Send email (${email}) on ${stage}`);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    logger.warn(`Alarm: Send email wasn't started: ${why}`);
  }
}
