// The mail command's own settings (cli.ts), read from the environment in this one module:
// where files are kept, where the schedule is published and which run this is. The mail
// settings themselves (MAIL_ENV, the sign-in, the recipient lists) are read from the same
// environment by config.ts. docs/configuration.md lists each variable.

import { existsSync } from "node:fs";
import path from "node:path";
import { jobConsoleUrl, JOBS_CONSOLE_URL, UPDATE_SCHEDULE_JOB } from "@kmcdc/cloud";

export interface CliSettings {
  /** Where relative paths on the command line start: where `pnpm` was run, or the process's own directory. */
  cwd: string;
  /** MAIL_OUTBOX: where the fake sender writes; `.outbox` at the repository root by default. */
  outboxDir: string;
  /** MAIL_STATE_FILE (relative to `cwd`): the mail memory; `.mail-state/state.json` by default. */
  stateFile: string;
  /** MAIL_STATE_BUCKET: the bucket that keeps the memory, where the environment has one (D63). */
  stateBucket: string | undefined;
  /** MAIL_SETTINGS: the emails' switches, as JSON text. */
  mailSettings: string | undefined;
  /** PUBLISHED_URL: the site whose schedule the emails list. */
  publishedUrl: string | undefined;
  /** This run's own log, when RUN_URL names one. */
  runUrl: string | undefined;
  /**
   * The Update schedule job's page in the Google Cloud console, where its runs are and where
   * Execute starts one: from PROJECT and REGION, which a job on Google has (D63). Without
   * them (a developer's machine), the console's list of jobs.
   */
  updateJobUrl: string;
}

/** The settings in `env`, for a repository at `root`. Pure. */
export function readCliSettings(
  env: NodeJS.ProcessEnv,
  root: string,
  processCwd: string,
): CliSettings {
  const cwd = env.INIT_CWD ?? processCwd;
  return {
    cwd,
    outboxDir: env.MAIL_OUTBOX || path.join(root, ".outbox"),
    stateFile: path.resolve(cwd, env.MAIL_STATE_FILE || path.join(root, ".mail-state/state.json")),
    stateBucket: env.MAIL_STATE_BUCKET,
    mailSettings: env.MAIL_SETTINGS,
    publishedUrl: env.PUBLISHED_URL,
    runUrl: env.RUN_URL || undefined,
    updateJobUrl:
      env.PROJECT && env.REGION
        ? jobConsoleUrl({ project: env.PROJECT, region: env.REGION, job: UPDATE_SCHEDULE_JOB })
        : JOBS_CONSOLE_URL,
  };
}

/**
 * This process's environment, with the gitignored .env at the repository root added when
 * there is one, and the command's settings in it.
 */
export function cliEnvironment(root: string): { env: NodeJS.ProcessEnv; settings: CliSettings } {
  const envFile = path.join(root, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  return { env: process.env, settings: readCliSettings(process.env, root, process.cwd()) };
}
