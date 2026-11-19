// The Problem email's memory between runs (AN-4, email.md §What triggers each email): a record
// in the mail memory (`problem` in state.json) while copying fails. No record → make one and
// email; a record whose last email is over 24 hours old → email again; the first good copy
// after → clear it and email "Schedule copying works again".

import type { MailState } from "./mail-state.ts";

/** Repeated failures email at most this often. */
export const EMAIL_EVERY_MS = 24 * 60 * 60 * 1000;

export interface ProblemReport {
  state: MailState;
  now: Date;
  /** Sends the Problem email. */
  send: () => Promise<unknown>;
}

/**
 * A failed copy: emails unless admins heard about it in the last 24 hours, and records it in
 * the mail memory. A failed send is recorded as not emailed (so the next run tries again) and
 * then rethrown.
 */
export async function reportProblem(r: ProblemReport): Promise<"emailed" | "skipped"> {
  const record = r.state.problem;
  const last = record?.emailedAt ?? null;
  if (last && r.now.getTime() - Date.parse(last) < EMAIL_EVERY_MS) return "skipped";
  const error = await attempt(r.send);
  r.state.problem = {
    since: record?.since ?? r.now.toISOString(),
    emailedAt: error === null ? r.now.toISOString() : last,
  };
  if (error !== null) throw error;
  return "emailed";
}

export interface WorkingReport {
  state: MailState;
  /** Sends "Schedule copying works again", given since when copying failed. */
  send: (failingSince: string) => Promise<unknown>;
}

/** A good copy: if copying was failing, clears the record and emails that it works again. */
export async function reportWorking(r: WorkingReport): Promise<"emailed" | "none"> {
  const record = r.state.problem;
  if (!record) return "none";
  const error = await attempt(() => r.send(record.since));
  r.state.problem = null;
  if (error !== null) throw error;
  return "emailed";
}

/** Runs `send`; its error, or null when it worked. */
async function attempt(send: () => Promise<unknown>): Promise<Error | null> {
  try {
    await send();
    return null;
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}
