// What each email needs and where it goes (email.md §What triggers each email, D51, D55):
// one function per email for Send email, and `afterCopy` for what is due after an Update
// schedule copy. The CLI (cli.ts) reads the settings and files and writes the memory.

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  classDaysWithout,
  easternDate,
  findDuplicates,
  nextNoClass,
  eventsCalendar,
  eventsEmailDue,
  prayerEvent,
  programDatesDue,
  scheduleChangesDue,
  programSessions,
  remindersDue,
  sessionAfter,
  sessionChanges,
  sessionRecord,
  SnapshotV2,
  type MailSettings,
  type NoClass,
  type Program,
  type SiteSettings,
} from "@kmcdc/domain";
import { mailConfig, type MailList } from "./config.ts";
import { reportProblem, reportWorking } from "./copy-problem.ts";
import { programState, type MailState } from "./mail-state.ts";
import {
  duplicatesEmail,
  eventsEmail,
  noClassEmail,
  problemEmail,
  programDatesEmail,
  scheduleChangesEmail,
  type DuplicatesInput,
  type Email,
  type ScheduleChangesInput,
} from "./templates/index.ts";

export interface SendContext {
  env: NodeJS.ProcessEnv;
  outboxDir: string;
  /** Its list, or a preview to DEV_EMAILS that records nothing (D55). */
  to: "list" | "me";
  now: Date;
  /** Where the run that led to the email can be read: its own log, or the Update schedule job's page. */
  runUrl: string;
  /** The Update schedule job's page in the Google Cloud console: its runs, and Execute. */
  updateJobUrl: string;
  /** The repository on GitHub (repository.ts), for the runbook's links in the emails. */
  repositoryUrl: string;
  site: SiteSettings;
  /** The published schedule (`/v2/feed/latest.json`). */
  schedule: () => Promise<SnapshotV2>;
  state: MailState;
  log: (line: string) => void;
}

const preview = (ctx: SendContext) => ctx.to === "me";

/** Sends one email to one list, or the preview to DEV_EMAILS; says so, without addresses. */
async function send(ctx: SendContext, list: MailList, make: () => Email): Promise<Email> {
  const config = mailConfig(ctx.env, {
    outboxDir: ctx.outboxDir,
    list: preview(ctx) ? "dev" : list,
  });
  const email = make();
  const subject = preview(ctx) ? `Preview: ${email.subject}` : email.subject;
  const sent = await config.send({
    from: config.from,
    to: config.recipients,
    ...email,
    subject,
  });
  const recipients = `${String(sent.recipients)} recipient${sent.recipients === 1 ? "" : "s"}`;
  ctx.log(
    config.env === "fake"
      ? `${subject}: wrote ${path.basename(sent.id)} (${recipients})`
      : `${subject}: sent to ${recipients} (Gmail message ${sent.id})`,
  );
  return email;
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

/** Schedule changes from a copy's `changes.json`; kept, to send again on request. */
export async function sendScheduleChanges(ctx: SendContext, file: string): Promise<void> {
  const input = await readJson(file);
  const changes = { ...(input as unknown as ScheduleChangesInput), runUrl: ctx.runUrl };
  const email = await send(ctx, "schedule-changes", () => scheduleChangesEmail(changes));
  if (!preview(ctx)) ctx.state.scheduleChanges = email;
}

/** The last Schedule changes email again, as it was (D55). */
export async function resendScheduleChanges(ctx: SendContext): Promise<void> {
  const last = ctx.state.scheduleChanges;
  if (!last) {
    ctx.log("Schedule changes: none has been sent yet; nothing to send.");
    return;
  }
  await send(ctx, "schedule-changes", () => last);
}

/** Duplicate events from a copy's `duplicates.json`, or from the published schedule. */
export async function sendDuplicates(ctx: SendContext, file?: string): Promise<void> {
  let input: DuplicatesInput;
  if (file) input = (await readJson(file)) as unknown as DuplicatesInput;
  else {
    const schedule = await ctx.schedule();
    input = {
      duplicates: findDuplicates(schedule.events),
      site: schedule.site,
      copiedAt: schedule.publishedAt,
    };
  }
  if (input.duplicates.duplicates.length + input.duplicates.clashes.length === 0) {
    ctx.log("Duplicate events: none on the schedule; nothing to send.");
    return;
  }
  await send(ctx, "duplicate-events", () => duplicatesEmail(input));
}

/**
 * KMC DC Events (AN-14): every event of the next 4 months, a calendar for each month. With
 * `scheduled`, as its timer sends it (D51): only when due, remembered so it goes once a day.
 */
export async function sendEvents(
  ctx: SendContext,
  options: { scheduled?: boolean } = {},
): Promise<void> {
  if (options.scheduled && !eventsEmailDue(ctx.now, ctx.state.eventsSent)) {
    ctx.log("KMC DC Events: not due now (Mondays, Wednesdays and Fridays, once); not sent.");
    return;
  }
  const schedule = await ctx.schedule();
  const calendar = eventsCalendar(
    schedule.events,
    {
      categoryKinds: schedule.site.categoryKinds,
      programs: ctx.site.programs,
      emailNames: ctx.site.emailNames,
    },
    ctx.now,
  );
  // The last good copy, remembered by the copy runs; the schedule is unchanged since.
  const copied = ctx.state.copiedAt;
  const asOf =
    copied && copied >= schedule.publishedAt
      ? { kind: "copy" as const, at: copied }
      : { kind: "published" as const, at: schedule.publishedAt };
  await send(ctx, "events", () => eventsEmail({ calendar, site: schedule.site, asOf }));
  if (options.scheduled && !preview(ctx)) ctx.state.eventsSent = ctx.now.toISOString();
}

export function findProgram(site: SiteSettings, id: string): Program {
  const program = site.programs.find((p) => p.id === id);
  if (!program) throw new Error(`No program "${id}" in data/site.json`);
  return program;
}

/** A program's sessions still ahead and its class days without a session still ahead. */
async function programNow(ctx: SendContext, program: Program) {
  const schedule = await ctx.schedule();
  const all = programSessions(schedule.events, program);
  const today = easternDate(ctx.now);
  const sessions = all.filter((s) => Date.parse(s.end ?? s.start) > ctx.now.getTime());
  // The last remembered session before the schedule's first: the class days in between
  // still count (a Sunday's reminder goes out after Tuesday's session has left the schedule).
  const first = all[0] ? easternDate(all[0].start) : today;
  const remembered = (programState(ctx.state, program.id).lastSessions ?? [])
    .map((s) => easternDate(s.start))
    .filter((d) => d < first && d < today);
  return {
    schedule,
    all,
    sessions,
    noClass: classDaysWithout(all, program, remembered.sort().at(-1)).filter((g) => g.to >= today),
  };
}

/** A program's dates (AN-16, AN-19). After a copy (`auto`), it also counts as Monday's. */
export async function sendProgramDates(
  ctx: SendContext,
  program: Program,
  options: { auto?: boolean } = {},
): Promise<void> {
  const { schedule, sessions, noClass } = await programNow(ctx, program);
  const memory = programState(ctx.state, program.id);
  const changes = sessionChanges(memory.lastSessions, sessions, ctx.now);
  const prayers = new Map(
    noClass.flatMap((g) => {
      const event = prayerEvent(schedule.events, g);
      return event ? [[g.from, event] as const] : [];
    }),
  );
  await send(ctx, program.id, () =>
    programDatesEmail({ program, sessions, noClass, changes, site: schedule.site, prayers }),
  );
  if (preview(ctx)) return;
  memory.lastSessions = sessions.map(sessionRecord);
  if (options.auto) memory.lastSent = ctx.now.toISOString();
}

async function sendNoClass(ctx: SendContext, program: Program, gap: NoClass): Promise<void> {
  const { schedule, all } = await programNow(ctx, program);
  await send(ctx, program.id, () =>
    noClassEmail({
      program,
      gap,
      next: sessionAfter(all, gap),
      site: schedule.site,
      prayer: prayerEvent(schedule.events, gap),
    }),
  );
  const memory = programState(ctx.state, program.id);
  if (!preview(ctx) && !memory.reminders.includes(gap.from)) memory.reminders.push(gap.from);
}

/** The next No class reminder of each program, at once (D55); it counts as sent. */
export async function sendNextReminders(ctx: SendContext): Promise<void> {
  for (const program of ctx.site.programs) {
    const { noClass } = await programNow(ctx, program);
    const gap = nextNoClass(noClass, ctx.now);
    if (gap) await sendNoClass(ctx, program, gap);
    else ctx.log(`${program.name}: no class day without a session ahead; no reminder to send.`);
  }
}

/** Problem from a copy's `problem.json`, at most once a day; or a preview of one. */
export async function sendProblem(ctx: SendContext, file?: string): Promise<void> {
  const input = file
    ? ((await readJson(file)) as {
        problem: string;
        failedAt: string;
        lastPublishedAt?: string | null;
      })
    : {
        problem: "Unreadable: Could not reach the feed (a preview: nothing failed).",
        failedAt: ctx.now.toISOString(),
      };
  const make = () =>
    problemEmail({
      kind: "failed",
      ...input,
      jobUrl: ctx.updateJobUrl,
      repositoryUrl: ctx.repositoryUrl,
    });
  if (preview(ctx)) {
    await send(ctx, "admin", make);
    return;
  }
  const result = await reportProblem({
    state: ctx.state,
    now: ctx.now,
    send: () => send(ctx, "admin", make),
  });
  if (result === "skipped")
    ctx.log("Problem: admins were emailed in the last 24 hours; not sent again.");
}

/**
 * "The app is behind the website" (NT-8), started by the server's check once the site has
 * differed for 15 minutes; at most once a day, by the Problem email's rule (AN-4).
 */
export async function sendBehind(ctx: SendContext, since?: string): Promise<void> {
  const make = () =>
    problemEmail({
      kind: "behind",
      since: since ?? ctx.now.toISOString(),
      jobUrl: ctx.updateJobUrl,
      repositoryUrl: ctx.repositoryUrl,
    });
  if (preview(ctx)) {
    await send(ctx, "admin", make);
    return;
  }
  if (!since) throw new Error("behind needs --since <time>, or --to me for a preview");
  const result = await reportProblem({
    state: ctx.state,
    now: ctx.now,
    send: () => send(ctx, "admin", make),
  });
  if (result === "skipped")
    ctx.log("Behind: admins were emailed in the last 24 hours; not sent again.");
}

/** After a good copy: if copying was failing, "works again" to admins. */
export async function sendWorking(ctx: SendContext): Promise<void> {
  const workingAt = ctx.now.toISOString();
  const result = await reportWorking({
    state: ctx.state,
    send: (failingSince) =>
      send(ctx, "admin", () =>
        problemEmail({ kind: "working", workingAt, failingSince, jobUrl: ctx.updateJobUrl }),
      ),
  });
  if (result === "none") ctx.log("Copying wasn't failing; nothing to send.");
}

export interface AfterCopy {
  /** The copy's `mail/` folder. */
  dir: string;
  result: "same" | "changed" | "failed";
  /** The new schedule was published. */
  published: boolean;
  settings: MailSettings;
  /** Where the mail memory is kept: the website as at the last Schedule changes goes here. */
  stateDir: string;
}

/**
 * Everything due after an Update schedule copy (D51), each email on its own: one that fails
 * is named and the others still go (AN-9). Returns the failures.
 */
export async function afterCopy(ctx: SendContext, copy: AfterCopy): Promise<string[]> {
  const failures: string[] = [];
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const file = (name: string) => {
    const f = path.join(copy.dir, name);
    return existsSync(f) ? f : null;
  };
  const { settings } = copy;

  if (copy.result === "failed") {
    const problem = file("problem.json");
    if (problem) await step("Problem", () => sendProblem(ctx, problem));
    return failures;
  }
  ctx.state.copiedAt = ctx.now.toISOString();
  await step("Works again", () => sendWorking(ctx));
  // Once a day, with the first good copy from 4 AM: every website change since the last one
  // (D62). Then this read of all the website's events is what the next one compares with.
  const website = file("website.json");
  if (website && scheduleChangesDue(ctx.now, ctx.state.changesDue)) {
    const changes = file("changes.json");
    const before = failures.length;
    if (settings.scheduleChanges && changes)
      await step("Schedule changes", () => sendScheduleChanges(ctx, changes));
    // A failed send keeps the earlier copy, so the next good copy that day tries again.
    if (failures.length === before) {
      await mkdir(copy.stateDir, { recursive: true });
      await copyFile(website, path.join(copy.stateDir, "website.json"));
      ctx.state.changesDue = ctx.now.toISOString();
    }
  }
  const duplicates = file("duplicates.json");
  if (settings.duplicates && duplicates)
    await step("Duplicate events", () => sendDuplicates(ctx, duplicates));
  for (const program of ctx.site.programs) {
    const memory = programState(ctx.state, program.id);
    if (settings.programs && programDatesDue(ctx.now, memory.lastSent))
      await step(`${program.name} dates`, () => sendProgramDates(ctx, program, { auto: true }));
    if (settings.reminders)
      await step(`${program.name} reminders`, async () => {
        const { noClass } = await programNow(ctx, program);
        for (const gap of remindersDue(noClass, memory.reminders, ctx.now))
          await sendNoClass(ctx, program, gap);
      });
  }
  return failures;
}
