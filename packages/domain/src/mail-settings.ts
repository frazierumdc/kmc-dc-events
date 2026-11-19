import { z } from "zod";

/**
 * `MAIL_SETTINGS` (AN-17, D51): one switch per email for the sends after a copy; when each
 * goes out is fixed. Send email works whatever they say.
 */
export const MailSettings = z
  .strictObject({
    scheduleChanges: z.boolean().default(true),
    duplicates: z.boolean().default(true),
    /** KMC DC Events (AN-14). */
    events: z.boolean().default(true),
    /** The switches of the emails it replaced: read, never written, and ignored. */
    prayers: z.boolean().optional(),
    specialEvents: z.boolean().optional(),
    prayersSpecial: z.boolean().optional(),
    programs: z.boolean().default(true),
    reminders: z.boolean().default(true),
  })
  .transform((s) => ({
    scheduleChanges: s.scheduleChanges,
    duplicates: s.duplicates,
    events: s.events,
    programs: s.programs,
    reminders: s.reminders,
  }));
export type MailSettings = z.infer<typeof MailSettings>;

/** The settings, or every email on with a warning when they are missing or invalid. */
export function parseMailSettings(raw: string | undefined): {
  settings: MailSettings;
  warning: string | null;
} {
  const all = MailSettings.parse({});
  if (!raw?.trim()) return { settings: all, warning: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { settings: all, warning: "MAIL_SETTINGS isn't JSON; every email is on." };
  }
  const parsed = MailSettings.safeParse(json);
  return parsed.success
    ? { settings: parsed.data, warning: null }
    : {
        settings: all,
        warning: `MAIL_SETTINGS is invalid (${parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}); every email is on.`,
      };
}
