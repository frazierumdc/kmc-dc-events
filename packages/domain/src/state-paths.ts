// Where each job keeps its memory (D63): one private bucket per environment, a folder per
// job, written only by that job's account. Every path is defined here and listed in
// docs/architecture/storage.md, with its writer, readers and life.

/** A Google project's environment: `your-project-id-dev` → `dev`; the prod project has no suffix. */
export function projectEnvironment(project: string): "dev" | "test" | "prod" {
  if (project.endsWith("-dev")) return "dev";
  if (project.endsWith("-test")) return "test";
  return "prod";
}

/** The environment's bucket: `your-project-id-dev-state`. */
export const stateBucketName = (project: string) =>
  `your-project-id-${projectEnvironment(project)}-state`;

/** `send-email/`, written only by `mail-sender@`. */
export const SEND_EMAIL = {
  /** The mail memory (mail-state.ts); older versions are kept 30 days. */
  state: "send-email/state.json",
  /** All the website's events as read at the last Schedule changes email (D62). */
  websiteAtLastChangesEmail: "send-email/website-at-last-changes-email.json",
} as const;

/** `update-schedule/`, written only by `feed-reader@`. */
export const UPDATE_SCHEDULE = {
  /** What one copy found for the emails, in one file; deleted after 7 days. */
  handOver: (run: string) => `update-schedule/runs/${run}/hand-over.json`,
  /** Held while a run works, so there is one at a time per project. */
  lock: "update-schedule/lock.json",
} as const;

/**
 * The featured events (EV-44), in update-schedule/ (the folder `feed-reader@` may read): the
 * owner uploads it, and the next Update schedule run shows its events as stories on the splash.
 */
export const FEATURED_FILE = "update-schedule/featured.json";
