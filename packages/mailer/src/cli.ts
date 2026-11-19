// pnpm mail test                   "Test from the KMC DC App" to the dev list (DEV_EMAILS).
//                                  A real one: run the stage's send-email job with EMAIL=test.
// pnpm mail after-copy             everything due after an Update schedule copy (D51):
//     --dir <copy's mail/ folder>  --result same|changed|failed  [--published]
// One email at once (D55; on Google, the send-email job run with EMAIL=<name>), to its list or with --to me to DEV_EMAILS as a preview:
// pnpm mail schedule-changes       the last Schedule changes email again
// pnpm mail changes <file>         Schedule changes from a copy's changes.json (AN-1, AN-2)
// pnpm mail duplicates [file]      Duplicate events (AN-13)
// pnpm mail events [--scheduled]   KMC DC Events (AN-14); --scheduled as its timer sends it
//                                  (D51): only when due and switched on, remembered
// pnpm mail program-fp|program-ttp a program's dates (AN-16, AN-19)
// pnpm mail reminders              each program's next No class reminder (AN-20)
// pnpm mail problem [file]         Problem, at most once a day, remembered in the mail memory
//                                  (AN-4); without a file, only as a preview
// pnpm mail behind --since <time>  "The app is behind the website" (NT-8), by the same rule;
//                                  without --since, only as a preview
// pnpm mail working                after a good copy: "Schedule copying works again"
//
// MAIL_ENV fake or unset writes to .outbox/ (or MAIL_OUTBOX) instead of sending. Settings come
// from the environment, or from a gitignored .env at the repository root: the schedule from
// PUBLISHED_URL (the send-email job has its own; on the Mac, set it) or --schedule <file>; the memory in MAIL_STATE_FILE
// (default .mail-state/state.json), kept in the project's bucket when MAIL_STATE_BUCKET names it
// (D63, state-bucket.ts); the switches in MAIL_SETTINGS. Links to the repository come from GITHUB_REPOSITORY, or the origin remote (D57). Recipient addresses are never printed (they're secrets, so they stay out of
// logs). Exit 1 when a send fails (AN-9); 2 for usage.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseMailSettings, SiteSettings, SnapshotV2 } from "@kmcdc/domain";
import { cliEnvironment } from "./cli-settings.ts";
import { mailConfig } from "./config.ts";
import { readMailState, writeMailState } from "./mail-state.ts";
import { accessToken, cloudBucket } from "@kmcdc/cloud";
import { pullMemory, pushMemory, type Pulled } from "./state-bucket.ts";
import { repositoryUrl } from "./repository.ts";
import {
  afterCopy,
  findProgram,
  resendScheduleChanges,
  sendBehind,
  sendDuplicates,
  sendEvents,
  sendNextReminders,
  sendProblem,
  sendProgramDates,
  sendScheduleChanges,
  sendWorking,
  type SendContext,
} from "./send.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const COMMANDS = [
  "test",
  "after-copy",
  "schedule-changes",
  "changes",
  "duplicates",
  "events",
  "program-fp",
  "program-ttp",
  "reminders",
  "problem",
  "behind",
  "working",
];
const USAGE = `Usage: pnpm mail ${COMMANDS.join(" | ")} [file] [--to list|me] [--scheduled]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    to: { type: "string", default: "list" },
    dir: { type: "string" },
    result: { type: "string" },
    published: { type: "boolean", default: false },
    since: { type: "string" },
    schedule: { type: "string" },
    scheduled: { type: "boolean", default: false },
  },
});
const [command = "", file] = positionals;
const to = values.to;
const result = values.result;
if (
  !COMMANDS.includes(command) ||
  (command === "changes" && !file) ||
  (to !== "list" && to !== "me") ||
  (command === "after-copy" &&
    (!values.dir || (result !== "same" && result !== "changed" && result !== "failed")))
) {
  console.error(USAGE);
  process.exit(2);
}

const { env, settings: cli } = cliEnvironment(ROOT);
const resolve = (f: string) => path.resolve(cli.cwd, f);
const { outboxDir, stateFile } = cli;
const warn = (message: string) => {
  console.error(message);
};

if (command === "test") {
  try {
    const config = mailConfig(env, { outboxDir, list: "dev" });
    const sentAt = new Date().toISOString();
    const sent = await config.send({
      from: config.from,
      to: config.recipients,
      subject: "Test from the KMC DC App",
      text: `This is a test from the KMC DC app, sent ${sentAt} (MAIL_ENV=${config.env}).\n\nIf you got it, emails can reach this list.\n`,
      html: `<p>This is a test from the KMC DC app, sent ${sentAt} (MAIL_ENV=${config.env}).</p><p>If you got it, emails can reach this list.</p>`,
    });
    const recipients = `${String(sent.recipients)} recipient${sent.recipients === 1 ? "" : "s"}`;
    console.log(
      config.env === "fake"
        ? `Wrote ${path.relative(ROOT, sent.id)} (${recipients})`
        : `Sent to ${recipients} (Gmail message ${sent.id})`,
    );
  } catch (error) {
    warn(`test: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
} else {
  let scheduleRead: Promise<SnapshotV2> | null = null;
  const schedule = () => {
    scheduleRead ??= readSchedule();
    return scheduleRead;
  };
  const repository = repositoryUrl(env, ROOT);
  // The memory comes from the environment's bucket where it has one (D63). A bucket that
  // can't be read stops the run before anything is sent: sending without the memory would
  // send again what already went out.
  const bucket = cli.stateBucket
    ? cloudBucket({ bucket: cli.stateBucket, token: () => accessToken(env) })
    : null;
  let pulled: Pulled | null = null;
  if (bucket) {
    try {
      pulled = await pullMemory(bucket, path.dirname(stateFile));
    } catch (error) {
      warn(`mail memory: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  const ctx: SendContext = {
    env,
    outboxDir,
    to,
    now: new Date(),
    // The run's own log when it names one; otherwise the Update schedule job's page.
    runUrl: cli.runUrl ?? cli.updateJobUrl,
    updateJobUrl: cli.updateJobUrl,
    repositoryUrl: repository,
    site: SiteSettings.parse(JSON.parse(await readFile(path.join(ROOT, "data/site.json"), "utf8"))),
    schedule,
    state: await readMailState(stateFile),
    log: (line) => {
      console.log(line);
    },
  };

  const failures: string[] = [];
  try {
    if (command === "after-copy") {
      const { settings, warning } = parseMailSettings(cli.mailSettings);
      if (warning) warn(warning);
      failures.push(
        ...(await afterCopy(ctx, {
          dir: resolve(values.dir ?? ""),
          result: result as "same" | "changed" | "failed",
          published: values.published,
          settings,
          stateDir: path.dirname(stateFile),
        })),
      );
    } else if (command === "schedule-changes") await resendScheduleChanges(ctx);
    else if (command === "changes") await sendScheduleChanges(ctx, resolve(file ?? ""));
    else if (command === "duplicates") await sendDuplicates(ctx, file && resolve(file));
    else if (command === "events") {
      const { settings, warning } = parseMailSettings(cli.mailSettings);
      if (warning) warn(warning);
      if (values.scheduled && !settings.events)
        console.log("KMC DC Events: switched off in MAIL_SETTINGS; not sent.");
      else await sendEvents(ctx, { scheduled: values.scheduled });
    } else if (command === "program-fp" || command === "program-ttp")
      await sendProgramDates(ctx, findProgram(ctx.site, command.slice(8)));
    else if (command === "reminders") await sendNextReminders(ctx);
    else if (command === "problem") {
      if (!file && to !== "me") throw new Error("problem needs a file, or --to me for a preview");
      await sendProblem(ctx, file && resolve(file));
    } else if (command === "behind") await sendBehind(ctx, values.since || undefined);
    else await sendWorking(ctx);
  } catch (error) {
    failures.push(`${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await writeMailState(stateFile, ctx.state);
  if (bucket && pulled) {
    try {
      const written = await pushMemory(bucket, path.dirname(stateFile), pulled);
      if (written.length > 0) console.log(`Mail memory kept in ${cli.stateBucket ?? ""}`);
    } catch (error) {
      failures.push(`mail memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const f of failures) warn(f);
  if (failures.length > 0) process.exitCode = 1;
}

/** The schedule the emails list: a file, or the published one. */
async function readSchedule(): Promise<SnapshotV2> {
  if (values.schedule)
    return SnapshotV2.parse(JSON.parse(await readFile(resolve(values.schedule), "utf8")));
  const published = cli.publishedUrl;
  if (!published)
    throw new Error(
      "Set PUBLISHED_URL (the site whose schedule the emails list), or pass --schedule <file>.",
    );
  const url = `${published.replace(/\/+$/, "")}/v2/feed/latest.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Could not read the schedule at ${url} (${String(response.status)})`);
  return SnapshotV2.parse(await response.json());
}
