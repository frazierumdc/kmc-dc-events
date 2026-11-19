// The update-schedule job (D63): copies the website, publishes a changed schedule, hands
// what it found to send-email and starts it, with one run at a time per project. The only
// way a schedule is published (ADR 0017).

import type { HandOver } from "./hand-over.ts";

export type CopyResult = "same" | "changed" | "failed";

/** Each step, so the order and the rules can be tested without Google or the website. */
export interface UpdateScheduleSteps {
  /** Takes the project's lock, waiting for another run; returns what releases it. */
  lock(): Promise<() => Promise<void>>;
  /** Copies the website (packages/sync's copy); its `mail/` files come back with the result. */
  copy(): Promise<{ result: CopyResult; files: Record<string, string> }>;
  /** Puts the new schedule on the site (packages/publish/publish-schedule.ts). */
  publish(): Promise<void>;
  /** Tells open apps: writes the new version to the live record (NT-1). */
  tellOpenApps(): Promise<void>;
  /** Sends the notifications for cancelled and moved events (D65), once published. */
  notify(): Promise<void>;
  /** Keeps the hand-over in the bucket for send-email. */
  handOver(handOver: HandOver): Promise<void>;
  /** Starts send-email for this run. */
  startEmail(): Promise<string>;
  log(line: string): void;
}

export interface UpdateScheduleOutcome {
  result: CopyResult;
  published: boolean;
  /** send-email was started. */
  emailed: boolean;
  /** The run failed: the copy did, or the publish. */
  failed: boolean;
}

/**
 * One run. A copy the check started ("wix") sends only Problem, when it fails: the timer's
 * next copy sends what else is due (D28). A publish that fails is told like a failed run,
 * and the emails still go, saying nothing was published.
 */
export async function updateSchedule(
  steps: UpdateScheduleSteps,
  trigger: string,
): Promise<UpdateScheduleOutcome> {
  const release = await steps.lock();
  try {
    const { result, files } = await steps.copy();
    let published = false;
    let publishFailed = false;
    if (result === "changed") {
      try {
        await steps.publish();
        published = true;
        // Right after the publish, before anything else: open apps hear within seconds. A
        // write that fails is only said: they check the site every minute anyway (NT-2).
        await steps.tellOpenApps().catch((error: unknown) => {
          steps.log(
            `Open apps weren't told: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
        // Only once the schedule that holds the change is on the site (NT-16); a failure is
        // only said, as the schedule is the record (NT-21).
        await steps.notify().catch((error: unknown) => {
          steps.log(
            `Notifications weren't sent: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      } catch (error) {
        publishFailed = true;
        steps.log(`Publishing failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await steps.handOver({ result, published, trigger, files });
    let emailed = false;
    if (result === "failed" || trigger !== "wix") {
      steps.log(`Started ${await steps.startEmail()}`);
      emailed = true;
    }
    return { result, published, emailed, failed: result === "failed" || publishFailed };
  } finally {
    await release();
  }
}
