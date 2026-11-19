// The stage's two Cloud Run jobs (D63), as the functions start them and read their runs.

import { accessToken, jobRuns, runJob } from "@kmcdc/cloud";
import { PROJECT, REGION, UPDATE_JOB } from "./options.ts";

/** A job's run, as far as the check's guard and alarm need it. */
export interface Run {
  /** What the run was for: "Update schedule (wix <fingerprint>)", "Send email (behind)". */
  title: string;
  started: Date;
  done: boolean;
  succeeded: boolean;
}

/** Starts one of the stage's jobs through Google's API, as this function's own account. */
export function startJob(job: string, env: Record<string, string> = {}): Promise<string> {
  return runJob({ project: PROJECT, region: REGION, job, env, token: () => accessToken() });
}

/**
 * A job's recent runs in the shape the check's guard and alarm read: named for what the
 * run was for, "Update schedule (wix <fingerprint>)" or "Send email (behind)".
 */
export async function googleRuns(job: string, since: Date): Promise<Run[]> {
  const runs = await jobRuns({
    project: PROJECT,
    region: REGION,
    job,
    since,
    token: () => accessToken(),
  });
  return runs.map((r) => ({
    title:
      job === UPDATE_JOB
        ? `Update schedule (${r.env.FINGERPRINT ?? ""})`
        : `Send email (${r.env.EMAIL ?? ""})`,
    started: r.started,
    done: r.done,
    succeeded: r.succeeded,
  }));
}
