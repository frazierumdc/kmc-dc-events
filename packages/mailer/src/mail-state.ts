// The mail memory between runs (`mail-state`, email.md §Memory between runs): each
// program's last dates email and the reminders sent, the last Schedule changes email and the
// website as it was then (website.json beside this file, D62), and
// when KMC DC Events last went out by its timer, when the schedule was last copied, and
// whether copying is failing (the Problem email's record). Kept in the environment's bucket
// (state-bucket.ts, docs/architecture/storage.md); a JSON file here.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SessionRecord } from "@kmcdc/domain";
import { z } from "zod";

const ProgramState = z.object({
  /** When its dates last went out after a copy (so the 4 PM copy doesn't send Monday's again). */
  lastSent: z.string().nullable().default(null),
  /** Its sessions as last emailed to its list (AN-19). */
  lastSessions: z.array(SessionRecord).nullable().default(null),
  /** The first class day of each No class reminder sent (AN-20). */
  reminders: z.array(z.string()).default([]),
});
export type ProgramState = z.infer<typeof ProgramState>;

export const MailState = z.object({
  programs: z.record(z.string(), ProgramState).default({}),
  /** The last Schedule changes email, to send again on request. */
  scheduleChanges: z
    .object({ subject: z.string(), text: z.string(), html: z.string() })
    .nullable()
    .default(null),
  /**
   * When the day's Schedule changes were last dealt with (sent, or nothing to tell): once a
   * day, with the 4:07 AM copy (AN-1, D62). The read of all the website's events it
   * compared with is kept beside this file as website.json.
   */
  changesDue: z.string().nullable().default(null),
  /** When KMC DC Events last went out by its timer (once a day, D51). */
  eventsSent: z.string().nullable().default(null),
  /** When the last good Update schedule copy ran: the email's "Copied on" (AN-14). */
  copiedAt: z.string().nullable().default(null),
  /**
   * While copying fails (AN-4): since when, and when admins were last emailed (null if the
   * email failed), so they hear at most once a day; cleared by the next good copy.
   */
  problem: z
    .object({ since: z.string(), emailedAt: z.string().nullable() })
    .nullable()
    .default(null),
});
export type MailState = z.infer<typeof MailState>;

/** The memory, or an empty one when there is none or it can't be read. */
export async function readMailState(file: string): Promise<MailState> {
  try {
    return MailState.parse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return MailState.parse({});
  }
}

export async function writeMailState(file: string, state: MailState): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
}

export function programState(state: MailState, id: string): ProgramState {
  const existing = state.programs[id];
  if (existing) return existing;
  const fresh = ProgramState.parse({});
  state.programs[id] = fresh;
  return fresh;
}
