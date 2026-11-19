// Starts a Cloud Run job through Google's own API (D63): one POST, with this run's settings
// laid over the job's own. The token never appears in errors.

/** The stage's two Cloud Run jobs, by the names their set-up gives them (scripts/setup-update-job.sh). */
export const UPDATE_SCHEDULE_JOB = "update-schedule";
export const SEND_EMAIL_JOB = "send-email";

/** Cloud Run's jobs in the Google Cloud console, for no project in particular. */
export const JOBS_CONSOLE_URL = "https://console.cloud.google.com/run/jobs";

/**
 * A job's page in the Google Cloud console: its runs, their logs, and Execute. Built from the
 * same three names that start the job (runJob), so it is the stage's own.
 */
export function jobConsoleUrl(job: { project: string; region: string; job: string }): string {
  return `${JOBS_CONSOLE_URL}/details/${encodeURIComponent(job.region)}/${encodeURIComponent(job.job)}/executions?project=${encodeURIComponent(job.project)}`;
}

export interface RunJobOptions {
  project: string;
  region: string;
  job: string;
  /** Settings for this run only, over the job's own. */
  env?: Record<string, string>;
  token: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}

/** Starts the job and returns the run's name, without waiting for it. */
export async function runJob(options: RunJobOptions): Promise<string> {
  const { project, region, job, env = {}, token, fetch = globalThis.fetch } = options;
  const overrides = Object.entries(env).map(([name, value]) => ({ name, value }));
  const response = await fetch(
    `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        overrides.length > 0 ? { overrides: { containerOverrides: [{ env: overrides }] } } : {},
      ),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error(`Google didn't start ${job} (${String(response.status)})`);
  const started = (await response.json()) as { metadata?: { name?: string } };
  return started.metadata?.name?.split("/").at(-1) ?? job;
}

/** One run of a job, as far as the check's guard and alarm need it. */
export interface JobRun {
  name: string;
  started: Date;
  done: boolean;
  succeeded: boolean;
  /** The run's settings, this run's own laid over the job's. */
  env: Record<string, string>;
}

/** A job's runs started since `since`, newest first. */
export async function jobRuns(options: {
  project: string;
  region: string;
  job: string;
  since: Date;
  token: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}): Promise<JobRun[]> {
  const { project, region, job, since, token, fetch = globalThis.fetch } = options;
  const runs: JobRun[] = [];
  let page = "";
  // Newest first, so reading stops at the first run older than `since`.
  for (;;) {
    const query = new URLSearchParams({ pageSize: "50", ...(page ? { pageToken: page } : {}) });
    const response = await fetch(
      `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}/executions?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${await token()}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(`Google didn't list the runs of ${job} (${String(response.status)})`);
    const list = (await response.json()) as {
      executions?: {
        name: string;
        createTime: string;
        completionTime?: string;
        succeededCount?: number;
        template?: { containers?: { env?: { name: string; value?: string }[] }[] };
      }[];
      nextPageToken?: string;
    };
    for (const e of list.executions ?? []) {
      const started = new Date(e.createTime);
      if (started < since) return runs;
      runs.push({
        name: e.name.split("/").at(-1) ?? e.name,
        started,
        done: e.completionTime !== undefined,
        succeeded: e.completionTime !== undefined && (e.succeededCount ?? 0) > 0,
        env: Object.fromEntries(
          (e.template?.containers?.[0]?.env ?? []).map((v) => [v.name, v.value ?? ""]),
        ),
      });
    }
    page = list.nextPageToken ?? "";
    if (!page) return runs;
  }
}
