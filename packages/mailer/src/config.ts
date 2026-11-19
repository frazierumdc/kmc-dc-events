// Mail settings from the environment (the send-email job's own, one job per stage, D52, D63, or
// .env on the Mac). Each environment holds its own lists under the same names. Every email
// comes from the center by name (D56), from MAIL_FROM's address, and goes to the lists'
// members in Bcc, not through the groups (D47).

import { getAccessToken, MailError, sendWithToken } from "./gmail.ts";
import { expandGroups, GroupsError } from "./groups.ts";
import { writeToOutbox } from "./fake.ts";
import type { Message } from "./mime.ts";

export type MailEnv = "prod" | "test" | "dev" | "fake";

/** The email lists (D47): one Google Group per email; `dev` is the Mail test email's list. */
export type MailList =
  "schedule-changes" | "duplicate-events" | "events" | "admin" | "fp" | "ttp" | "dev";

/** The sender's name on every email (D56). */
export const SENDER_NAME = "Kadampa Meditation Center DC";

/** Each list's secrets, under the same names in every mail environment (D52). */
export const LIST_SECRETS: Record<MailList, readonly string[]> = {
  "schedule-changes": ["SCHEDULE_CHANGES_EMAILS"],
  "duplicate-events": ["DUPLICATE_EVENTS_EMAILS"],
  events: ["EVENTS_EMAILS"],
  admin: ["ADMIN_EMAILS"],
  fp: ["FP_EMAILS"],
  ttp: ["TTP_EMAILS"],
  dev: ["DEV_EMAILS"],
};

/** What a send did: Gmail's message id (the file, for fake), and how many it reached. */
export interface Sent {
  id: string;
  recipients: number;
}

/** Gmail's limit is 2,000 recipients a message, 500 of them outside the center. */
export const BCC_BATCH = 400;

export interface MailConfig {
  env: MailEnv;
  from: string;
  /** The list's addresses (D47, D52): groups, or people. */
  recipients: string[];
  /** Sends to `to`: each group is replaced by its members, in Bcc (D47). */
  send: (message: Message) => Promise<Sent>;
}

export function mailConfig(
  env: NodeJS.ProcessEnv,
  options: {
    outboxDir: string;
    /** The list; admins by default. */
    list?: MailList;
    fetch?: typeof globalThis.fetch;
  },
): MailConfig {
  const mailEnv = parseMailEnv(env.MAIL_ENV);
  const list = options.list ?? "admin";
  const from = sender(env.MAIL_FROM || (mailEnv === "fake" ? "app@example.com" : ""));
  const fromAddress = /<([^>]+)>/.exec(from)?.[1] ?? "";
  const groupDomain = fromAddress.split("@")[1] ?? "";
  const recipients = [
    ...new Set(LIST_SECRETS[list].flatMap((name) => readList(env, name, groupDomain))),
  ];
  const listName = LIST_SECRETS[list].join(" or ");

  if (mailEnv === "fake") {
    return {
      env: mailEnv,
      from,
      recipients: recipients.length > 0 ? recipients : [`${list}@example.com`],
      send: async (message) => ({
        id: await writeToOutbox(message, options.outboxDir),
        recipients: message.to.length,
      }),
    };
  }

  const missing = [
    ...(env.MAIL_FROM ? [] : ["MAIL_FROM"]),
    ...(recipients.length > 0 ? [] : [listName]),
    ...["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].filter((n) => !env[n]),
  ];
  if (missing.length > 0) {
    throw new MailError(`MAIL_ENV=${mailEnv} needs ${missing.join(", ")}`, "auth");
  }
  const credentials = {
    clientId: env.GMAIL_CLIENT_ID ?? "",
    clientSecret: env.GMAIL_CLIENT_SECRET ?? "",
    refreshToken: env.GMAIL_REFRESH_TOKEN ?? "",
  };
  const gmail = { fetch: options.fetch };
  return {
    env: mailEnv,
    from,
    recipients,
    send: async (message) => {
      const token = await getAccessToken(credentials, gmail);
      // DEV_EMAILS is a person, not a group: the Mail test email and previews go straight to it.
      if (list === "dev") {
        const id = await sendWithToken(message, token, gmail);
        return { id, recipients: message.to.length };
      }
      let people: string[];
      try {
        people = await expandGroups(message.to, token, { sender: fromAddress, ...gmail });
      } catch (error) {
        // Never sent to the group's address instead: a group that doesn't exist yet, or that
        // the sender doesn't manage, would get it as a plain address (D47).
        if (!(error instanceof GroupsError)) throw error;
        throw new MailError(
          `${error.message}. Nothing sent: check the group exists, the sender is its Manager and the sign-in allows viewing groups (docs/architecture/email.md §Recipients)`,
          "send",
        );
      }
      if (people.length === 0) {
        throw new MailError(`No one to send to: ${message.to.join(", ")} has no members`, "send");
      }
      const ids: string[] = [];
      for (let i = 0; i < people.length; i += BCC_BATCH) {
        const bcc = people.slice(i, i + BCC_BATCH);
        ids.push(await sendWithToken({ ...message, to: [fromAddress], bcc }, token, gmail));
      }
      return { id: ids.join(", "), recipients: people.length };
    },
  };
}

/** `Kadampa Meditation Center DC <address>`, from MAIL_FROM's address (with or without a name). */
export function sender(mailFrom: string): string {
  const address = /<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom.trim();
  return `${SENDER_NAME} <${address}>`;
}

function parseMailEnv(value: string | undefined): MailEnv {
  if (!value) return "fake";
  if (value === "prod" || value === "test" || value === "dev" || value === "fake") return value;
  throw new MailError(`MAIL_ENV must be prod, test, dev or fake, not "${value}"`, "auth");
}

/** One address: a name, an @ and a domain with a dot, with nothing a header would misread. */
const ADDRESS = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]+$/;
/** A name alone: the part before the @ of an address at the center's domain. */
const GROUP_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * A list secret's addresses, separated by commas.
 * A name alone is the group, or for DEV_EMAILS the person, at `groupDomain`, the sender's:
 * the center's groups are all at its domain, the one `expandGroups` looks groups up at (D47).
 * Anything else that isn't an address is refused here, by the secret's name and without
 * showing it, rather than reaching Gmail as a Bcc recipient.
 */
function readList(env: NodeJS.ProcessEnv, name: string, groupDomain: string): string[] {
  const addresses = (env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (groupDomain && GROUP_NAME.test(value) ? `${value}@${groupDomain}` : value));
  const bad = addresses.filter((address) => !ADDRESS.test(address)).length;
  if (bad > 0) {
    const names = groupDomain ? `names at ${groupDomain} or email addresses` : "email addresses";
    throw new MailError(
      `${name} must hold ${names}, separated by commas: ${String(bad)} of its ${String(addresses.length)} ${addresses.length === 1 ? "value isn't" : "values aren't"}`,
      "auth",
    );
  }
  return addresses;
}
