// The send-email job (D63): after a copy, everything that is due (D51), from what the copy
// handed over; or one email by name, as its timer or a person asks. It works out the
// Schedule changes itself, from all the website's events as the copy read them and its own
// read kept at the last Schedule changes email (D62), so the copy never reads the mail memory.

import { FeedEnvelope, hasReadChanges } from "@kmcdc/domain";
import { websiteReadChanges, type ChangesFile } from "@kmcdc/sync";
import { HandOver } from "./hand-over.ts";

/**
 * `changes.json` for the mailer, or null when there is nothing to tell: no read kept yet
 * (the first day), no read this time, or nothing changed on the website since the one kept.
 */
export function scheduleChanges(
  files: Record<string, string>,
  earlierWebsite: string | null,
): ChangesFile | null {
  const website = parseFeed(files["website.json"]);
  if (!website) return null;
  const changes = websiteReadChanges(parseFeed(earlierWebsite ?? undefined), website);
  return changes && hasReadChanges(changes) ? { changes } : null;
}

function parseFeed(text: string | undefined): FeedEnvelope | null {
  if (!text) return null;
  const parsed = FeedEnvelope.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

export interface SendEmailSteps {
  /** The hand-over of a run, from the bucket; null when there is none. */
  readHandOver(run: string): Promise<string | null>;
  /** All the website's events as at the last Schedule changes email, from the mail memory; null before the first. */
  earlierWebsite(): Promise<string | null>;
  /** Puts the copy's files where the mailer reads them. */
  writeFiles(files: Record<string, string>): Promise<void>;
  /** Runs the mailer with these arguments; its exit code. */
  mail(args: string[]): Promise<number>;
  log(line: string): void;
}

/** What a run of the job is asked: after a copy (`run`), or one email by name. */
export interface SendEmailAsk {
  run?: string;
  email?: string;
  to?: string;
  scheduled?: boolean;
  /** For `behind`: since when the app has differed from the website (NT-8). */
  since?: string;
}

/** One run; returns the mailer's exit code (1 when an email failed). */
export async function sendEmail(steps: SendEmailSteps, ask: SendEmailAsk): Promise<number> {
  if (ask.run) {
    const text = await steps.readHandOver(ask.run);
    if (text === null) throw new Error(`No hand-over for the run ${ask.run}`);
    const handOver = HandOver.parse(JSON.parse(text));
    const files = { ...handOver.files };
    // A hand-over written before the copy stopped making its own changes.json may hold one:
    // it is never used, the comparison is this job's.
    delete files["changes.json"];
    const changes =
      handOver.result === "failed" ? null : scheduleChanges(files, await steps.earlierWebsite());
    if (changes) files["changes.json"] = `${JSON.stringify(changes)}\n`;
    await steps.writeFiles(files);
    steps.log(
      `After the copy ${ask.run}: ${handOver.result}${handOver.published ? ", published" : ""}${changes ? ", with Schedule changes" : ""}`,
    );
    return steps.mail([
      "after-copy",
      "--result",
      handOver.result,
      ...(handOver.published ? ["--published"] : []),
    ]);
  }
  if (!ask.email) throw new Error("Nothing asked: set RUN (after a copy) or EMAIL (one email).");
  return steps.mail([
    ask.email,
    "--to",
    ask.to === "me" ? "me" : "list",
    ...(ask.scheduled ? ["--scheduled"] : []),
    ...(ask.since ? ["--since", ask.since] : []),
  ]);
}
