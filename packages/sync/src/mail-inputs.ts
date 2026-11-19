import {
  findDuplicates,
  type Duplicates,
  type PublishedSite,
  type SnapshotV2,
  type WebsiteReadChanges,
} from "@kmcdc/domain";

/**
 * What the update job's emails are made from (email.md §What triggers each email): the
 * files `pnpm copy` writes to `<out>/mail/`, which the update job hands over to the
 * send-email job. Pure; `copy-cli.ts` writes them.
 */

/**
 * `mail/changes.json`: the Schedule changes email (AN-1, AN-2, D62). Written by the
 * send-email job, which makes the comparison; the copy only keeps the website as it read it.
 */
export interface ChangesFile {
  changes: WebsiteReadChanges;
}

/** `mail/duplicates.json`: the Duplicate events email (AN-13, D51). */
export interface DuplicatesFile {
  duplicates: Duplicates;
  site: PublishedSite;
  copiedAt: string;
}

/** `mail/problem.json`: the Problem email (AN-4). */
export interface ProblemFile {
  problem: string;
  failedAt: string;
  /** When the schedule phones have was published; null before the first, absent when unknown. */
  lastPublishedAt?: string | null;
}

export interface MailInputs {
  duplicates: DuplicatesFile | null;
}

/**
 * After a copy that passed its checks: Duplicate events whenever the schedule has any,
 * published or not.
 */
export function mailInputs(schedule: SnapshotV2, copiedAt: string): MailInputs {
  const duplicates = findDuplicates(schedule.events);
  return {
    duplicates:
      duplicates.duplicates.length + duplicates.clashes.length > 0
        ? { duplicates, site: schedule.site, copiedAt }
        : null,
  };
}
