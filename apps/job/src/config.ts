// The container job's settings, read from its environment in this one module (set by the
// job's deploy; docs/configuration.md lists each variable). main.ts takes the result.
//
// A setting only one step uses is checked when that step reads it, not at start-up: a stage
// with no live record or no notifications leaves those settings out and still runs.

export type Env = Record<string, string | undefined>;

/** The settings a step can't run without. */
export type RequiredSetting =
  | "JOB"
  | "PROJECT"
  | "REGION"
  | "STATE_BUCKET"
  | "HOSTING_SITE"
  | "PUBLIC_BASE_URL"
  | "SEND_EMAIL_JOB";

export interface JobConfig {
  /** The whole environment: the programs each step starts inherit it, and the sign-in reads it. */
  env: Env;
  /** JOB_WORK_DIR: where a run keeps its files. */
  workDir: string;
  /** Cloud Run's own name for this run; undefined on a developer's machine. */
  execution: string | undefined;
  /** TRIGGER: "wix" when the server's check started the run; "" otherwise. */
  trigger: string;
  /** LIVE_URL: the live record open apps listen to, where the stage has one. */
  liveUrl: string | undefined;
  /** What send-email was started for. */
  email: {
    run: string | undefined;
    email: string | undefined;
    to: string | undefined;
    scheduled: boolean;
    since: string | undefined;
  };
  /** A required setting's value; throws, naming it, when it is missing or empty. */
  need: (name: RequiredSetting) => string;
}

/** The job's settings in `env`. Pure. */
export function readJobConfig(env: Env): JobConfig {
  return {
    env,
    workDir: env.JOB_WORK_DIR ?? "/tmp/job",
    execution: env.CLOUD_RUN_EXECUTION,
    trigger: env.TRIGGER ?? "",
    liveUrl: env.LIVE_URL,
    email: {
      run: env.RUN,
      email: env.EMAIL,
      to: env.TO,
      scheduled: env.SCHEDULED === "true",
      since: env.SINCE,
    },
    need: (name) => {
      const value = env[name];
      if (!value) throw new Error(`The job has no ${name} setting.`);
      return value;
    },
  };
}

/** The settings of this process. */
export function jobConfig(): JobConfig {
  return readJobConfig(process.env);
}
