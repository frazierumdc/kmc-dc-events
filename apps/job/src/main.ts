// node apps/job/src/main.ts    the entry of both Cloud Run jobs (D63); JOB says which:
//
//   JOB=update-schedule   copy → publish → hand over → start send-email, as feed-reader@
//   JOB=send-email        after a copy (RUN=<the copy's run>) or one email (EMAIL=events,
//                         TO=list|me, SCHEDULED=true; SINCE=<time> for behind), as mail-sender@.
//                         By hand: Execute with overrides in Cloud Run, setting EMAIL (and
//                         TO=me for a preview); EMAIL=test sends the test email to DEV_EMAILS
//
// Settings come from the job's own environment and Secret Manager (set by its deploy):
// PROJECT, REGION, STATE_BUCKET; update-schedule: LIVE_URL (the live record, where the stage
// has one), HOSTING_SITE, PUBLIC_BASE_URL (the site's
// address in its pages), PUBLISHED_URL (the site the copy compares with), WIX_FEED_TOKEN,
// SEND_EMAIL_JOB, and TRIGGER=wix when the server's check started it (after a publish it also
// sends the copy's notifications, as feed-reader@, D65); send-email: the
// mailer's own (packages/mailer/src/cli.ts). Each step is one of the repository's programs,
// started as its own process. Exit 1 when the run failed.

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  accessToken,
  cloudBucket,
  LIVE_SCOPES,
  runJob,
  sendMessage,
  takeLock,
  writeLiveVersion,
} from "@kmcdc/cloud";
import { FEATURED_FILE, SEND_EMAIL, UPDATE_SCHEDULE, type Notice } from "@kmcdc/domain";
import { jobConfig } from "./config.ts";
import { readMailFiles, writeMailFiles } from "./hand-over.ts";
import { sendNotices } from "./notify.ts";
import { sendEmail } from "./send-email.ts";
import { updateSchedule, type CopyResult } from "./update-schedule.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const config = jobConfig();
const { env, need } = config;
const WORK = config.workDir;
const log = (line: string) => {
  console.log(line);
};

/** Runs one of the repository's programs, its output in this run's log; its exit code. */
function run(script: string, args: string[], extra: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
      cwd: ROOT,
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

/** This run's name: Cloud Run's own, or the time on the Mac. */
const runName = config.execution ?? `local-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const token = () => accessToken(env);
const timed = async <T>(what: string, work: () => Promise<T>): Promise<T> => {
  const started = Date.now();
  try {
    return await work();
  } finally {
    log(`[${what}: ${((Date.now() - started) / 1000).toFixed(1)} s]`);
  }
};

async function main(): Promise<number> {
  const job = need("JOB");
  const bucket = cloudBucket({ bucket: need("STATE_BUCKET"), token });
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  if (job === "update-schedule") {
    const copyDir = path.join(WORK, "copy");
    const { trigger } = config;
    const outcome = await updateSchedule(
      {
        lock: () => takeLock({ bucket, name: UPDATE_SCHEDULE.lock, holder: runName, log }),
        copy: () =>
          timed("copy", async () => {
            // The featured events (EV-44): featured.json in the bucket, when it is there.
            const featured = await bucket.read(FEATURED_FILE);
            const featuredPath = path.join(WORK, "featured.json");
            if (featured) await writeFile(featuredPath, featured.text);
            const code = await run("packages/sync/src/copy-cli.ts", [
              "--out",
              copyDir,
              ...(featured ? ["--featured", featuredPath] : []),
            ]);
            if (code !== 0 && code !== 10 && code !== 1)
              throw new Error(`The copy stopped with exit code ${String(code)}.`);
            const result: CopyResult = code === 10 ? "changed" : code === 0 ? "same" : "failed";
            return { result, files: await readMailFiles(path.join(copyDir, "mail")) };
          }),
        publish: () =>
          timed("publish", async () => {
            const code = await run("packages/publish/publish-schedule.ts", [
              "--site",
              need("HOSTING_SITE"),
              "--origin",
              need("PUBLIC_BASE_URL"),
              "--schedule",
              path.join(copyDir, "v2/feed"),
            ]);
            if (code !== 0) throw new Error(`exit code ${String(code)}`);
          }),
        tellOpenApps: () =>
          timed("live record", async () => {
            // A stage with no live record has no LIVE_URL, and nothing to tell.
            if (!config.liveUrl) return;
            const manifest = JSON.parse(
              await readFile(path.join(copyDir, "v2/feed/manifest.json"), "utf8"),
            ) as { version: string };
            await writeLiveVersion({
              url: config.liveUrl,
              version: manifest.version,
              token: () => accessToken(env, fetch, LIVE_SCOPES),
            });
          }),
        notify: () =>
          timed("notifications", async () => {
            // The copy writes notify.json only on a change (packages/sync/src/copy-cli.ts).
            const file = path.join(copyDir, "notify.json");
            const notices = JSON.parse(await readFile(file, "utf8").catch(() => "[]")) as Notice[];
            await sendNotices(
              notices,
              (body) => sendMessage({ project: need("PROJECT"), body, token }),
              log,
            );
          }),
        handOver: async (handOver) => {
          await bucket.write(UPDATE_SCHEDULE.handOver(runName), JSON.stringify(handOver), "0");
        },
        startEmail: () =>
          runJob({
            project: need("PROJECT"),
            region: need("REGION"),
            job: need("SEND_EMAIL_JOB"),
            env: { RUN: runName },
            token,
          }),
        log,
      },
      trigger,
    );
    log(
      `update-schedule ${runName}${trigger ? ` (${trigger})` : ""}: ${outcome.result}${outcome.published ? ", published" : ""}${outcome.emailed ? ", send-email started" : ""}`,
    );
    return outcome.failed ? 1 : 0;
  }

  if (job === "send-email") {
    const mailDir = path.join(WORK, "mail");
    const read = async (name: string) => (await bucket.read(name))?.text ?? null;
    return sendEmail(
      {
        readHandOver: (name) => read(UPDATE_SCHEDULE.handOver(name)),
        earlierWebsite: () => read(SEND_EMAIL.websiteAtLastChangesEmail),
        writeFiles: (files) => writeMailFiles(mailDir, files),
        mail: (args) =>
          timed("mail", () =>
            run(
              "packages/mailer/src/cli.ts",
              args[0] === "after-copy" ? [...args, "--dir", mailDir] : args,
              {
                MAIL_STATE_BUCKET: need("STATE_BUCKET"),
                MAIL_STATE_FILE: path.join(WORK, "mail-state/state.json"),
              },
            ),
          ),
        log,
      },
      config.email,
    );
  }

  throw new Error(`JOB must be update-schedule or send-email, not ${job}.`);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
