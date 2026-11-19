// The sign-in command's arguments, its account check and its prompt (authorize.ts, D60).

import { createInterface } from "node:readline";

export const USAGE =
  "Usage: pnpm mail:authorize <project-id> [--from <sending address>] [--new-client]";

/** A Google Cloud project id: 6 to 30 lower-case letters, digits and hyphens, starting with a letter. */
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export interface AuthorizeArgs {
  /** The stage's own Google project: where the sign-in is stored and the send-email job runs. */
  project: string;
  /** The sending account, when given; otherwise it is read from the send-email job. */
  from: string | null;
  newClient: boolean;
}

export function parseAuthorizeArgs(argv: readonly string[]): AuthorizeArgs | { error: string } {
  let from: string | null = null;
  let newClient = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--new-client") newClient = true;
    else if (arg === "--from") {
      from = argv[++i] ?? "";
      if (!from || from.startsWith("--")) return { error: USAGE };
    } else rest.push(arg);
  }
  const [project, ...extra] = rest;
  if (!project || extra.length > 0 || !PROJECT_ID.test(project)) return { error: USAGE };
  return { project, from, newClient };
}

/** The job that sends the stage's email, and the region every job runs in (scripts/setup-update-job.sh). */
export const SEND_EMAIL_JOB = "send-email";
export const JOBS_REGION = "us-east4";

/** The `gcloud` arguments that describe the stage's send-email job as JSON. */
export function describeJobArgs(project: string): string[] {
  return [
    "run",
    "jobs",
    "describe",
    SEND_EMAIL_JOB,
    "--project",
    project,
    "--region",
    JOBS_REGION,
    "--format=json",
  ];
}

/**
 * One of a Cloud Run job's own settings, from `gcloud run jobs describe --format=json`: the
 * plain value of the environment variable `name` on its first container. "" when the job has
 * none, the value is a secret's, or the text isn't a job.
 */
export function jobSetting(describedJob: string, name: string): string {
  try {
    const job = JSON.parse(describedJob) as {
      spec?: {
        template?: {
          spec?: {
            template?: {
              spec?: { containers?: { env?: { name?: string; value?: unknown }[] }[] };
            };
          };
        };
      };
    };
    const env = job.spec?.template?.spec?.template?.spec?.containers?.[0]?.env ?? [];
    const value = env.find((e) => e.name === name)?.value;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/** Asks one question in the terminal; `hidden` shows nothing as the answer is typed. */
export function ask(question: string, options: { hidden?: boolean } = {}): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (options.hidden) {
    // Write the question, then swallow the echo of each typed character.
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let asked = false;
    output._writeToOutput = (s: string) => {
      if (!asked) {
        process.stdout.write(s);
        asked = true;
      } else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** The address in MAIL_FROM (`Name <address>` or just the address), lower case. */
export function sendingAddress(mailFrom: string): string {
  return (/<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom).trim().toLowerCase();
}

/**
 * The account Google signed in, from the ID token it returned with the refresh token. It comes
 * straight from Google's token endpoint, so its signature isn't checked here.
 */
export function signedInAs(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}
