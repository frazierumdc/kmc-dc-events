import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { BCC_BATCH, mailConfig, type MailList } from "./config.ts";
import { MailError, TOKEN_URL } from "./gmail.ts";

const gmail = {
  MAIL_FROM: "KMC DC Events App <app@example.com>",
  ADMIN_EMAILS: "admin1@example.com, admin2@example.com",
  FP_EMAILS: "fp@example.com",
  TTP_EMAILS: "ttp@example.com",
  DEV_EMAILS: "dev@example.com",
  GMAIL_CLIENT_ID: "id",
  GMAIL_CLIENT_SECRET: "secret",
  GMAIL_REFRESH_TOKEN: "refresh",
};

test("with MAIL_ENV unset, messages go to .outbox/ instead of Gmail", async () => {
  const outboxDir = await mkdtemp(path.join(tmpdir(), "outbox-"));
  const config = mailConfig({}, { outboxDir });
  expect(config.env).toBe("fake");
  expect(config.from).toBe("Kadampa Meditation Center DC <app@example.com>");
  const { id: file } = await config.send({
    from: config.from,
    to: config.recipients,
    subject: "Test",
    text: "Hello",
  });
  expect(path.dirname(file)).toBe(outboxDir);
  expect(await readFile(file, "utf8")).toContain("To: admin@example.com");
});

test("prod and dev both send to the environment's own ADMIN_EMAILS, from the center (D52, D56)", () => {
  const prod = mailConfig({ ...gmail, MAIL_ENV: "prod" }, { outboxDir: "" });
  expect(prod.recipients).toEqual(["admin1@example.com", "admin2@example.com"]);
  expect(prod.from).toBe("Kadampa Meditation Center DC <app@example.com>");
  const dev = mailConfig(
    { ...gmail, MAIL_ENV: "dev", MAIL_FROM: "app@example.com" },
    { outboxDir: "" },
  );
  expect(dev.recipients).toEqual(["admin1@example.com", "admin2@example.com"]);
  expect(dev.from).toBe("Kadampa Meditation Center DC <app@example.com>");
});

test("each list has its own secret, the same name in every stage (D47, D52)", () => {
  const to = (list: MailList, extra: Record<string, string> = {}) =>
    mailConfig({ ...gmail, MAIL_ENV: "dev", ...extra }, { outboxDir: "", list }).recipients;
  expect(to("fp")).toEqual(["fp@example.com"]);
  expect(to("ttp")).toEqual(["ttp@example.com"]);
  expect(() =>
    mailConfig(
      { ...gmail, MAIL_ENV: "dev", FP_EMAILS: "" },
      {
        outboxDir: "",
        list: "fp",
      },
    ),
  ).toThrow("MAIL_ENV=dev needs FP_EMAILS");
});

test("each staff email goes to its own group, and to no other list when its secret isn't set (D47)", () => {
  const own = {
    SCHEDULE_CHANGES_EMAILS: "schedule-changes-dev@example.com",
    DUPLICATE_EVENTS_EMAILS: "duplicate-events-dev@example.com",
    EVENTS_EMAILS: "events-list-dev@example.com",
  };
  const to = (list: MailList, env: Record<string, string>) =>
    mailConfig({ ...gmail, MAIL_ENV: "dev", ...env }, { outboxDir: "", list }).recipients;
  expect(to("schedule-changes", own)).toEqual(["schedule-changes-dev@example.com"]);
  expect(to("duplicate-events", own)).toEqual(["duplicate-events-dev@example.com"]);
  expect(to("events", own)).toEqual(["events-list-dev@example.com"]);
  // No shared staff list stands in: a secret that isn't set stops the send, by name.
  const names = {
    "schedule-changes": "SCHEDULE_CHANGES_EMAILS",
    "duplicate-events": "DUPLICATE_EVENTS_EMAILS",
    events: "EVENTS_EMAILS",
  } as const;
  for (const list of ["schedule-changes", "duplicate-events", "events"] as const) {
    const env = { ...gmail, MAIL_ENV: "dev", MANAGEMENT_EMAILS: "management@example.com" };
    expect(() => mailConfig(env, { outboxDir: "", list })).toThrow(
      new RegExp(`^MAIL_ENV=dev needs ${names[list]}$`),
    );
  }
});

test("the test email goes to DEV_EMAILS", () => {
  const config = mailConfig({ ...gmail, MAIL_ENV: "prod" }, { outboxDir: "", list: "dev" });
  expect(config.recipients).toEqual(["dev@example.com"]);
});

test("Gmail settings that are missing are named, and a bad MAIL_ENV is refused", () => {
  expect(() =>
    mailConfig({ MAIL_ENV: "dev", MAIL_FROM: "a@example.com" }, { outboxDir: "" }),
  ).toThrow(
    "MAIL_ENV=dev needs ADMIN_EMAILS, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN",
  );
  expect(() => mailConfig({ MAIL_ENV: "staging" }, { outboxDir: "" })).toThrow(MailError);
});

test("a name alone gets the sender's domain, the center's, in every list (D47)", () => {
  const env = {
    ...gmail,
    MAIL_ENV: "dev",
    MAIL_FROM: "KMC DC Events App <events@example.org>",
    ADMIN_EMAILS: "problems-dev, Staff.Two , outside@example.com",
  };
  expect(mailConfig(env, { outboxDir: "" }).recipients).toEqual([
    "problems-dev@example.org",
    "Staff.Two@example.org",
    "outside@example.com",
  ]);
  // Every list reads the same way, DEV_EMAILS, a person, too.
  expect(
    mailConfig({ ...env, DEV_EMAILS: "developer" }, { outboxDir: "", list: "dev" }).recipients,
  ).toEqual(["developer@example.org"]);
});

test("a list value that isn't an email address is refused, named by its secret and never shown", () => {
  for (const value of [
    "problems dev",
    "admin1@other.org, problems-dev@",
    "a@other.org; b@other.org",
  ]) {
    let error: unknown;
    try {
      mailConfig({ ...gmail, MAIL_ENV: "dev", ADMIN_EMAILS: value }, { outboxDir: "" });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(MailError);
    expect((error as MailError).kind).toBe("auth");
    expect((error as MailError).message).toContain("ADMIN_EMAILS");
    expect((error as MailError).message).not.toContain("problems");
    expect((error as MailError).message).not.toContain("other.org");
  }
});

describe("sending to a group's members (D47)", () => {
  const env = {
    ...gmail,
    MAIL_ENV: "dev",
    MAIL_FROM: "events@example.org",
    TTP_EMAILS: "ttp@example.org",
  };
  const message = { subject: "No class", text: "Hello" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const raw = (init: RequestInit | undefined) =>
    Buffer.from((JSON.parse(init?.body as string) as { raw: string }).raw, "base64url").toString(
      "utf8",
    );

  function fakeFetch(answer: (url: string) => Response) {
    const sent: string[] = [];
    const fetch = (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.startsWith(TOKEN_URL)) return Promise.resolve(json({ access_token: "access" }));
      if (url.includes("/messages/send")) {
        sent.push(raw(init));
        return Promise.resolve(json({ id: `m${String(sent.length)}` }));
      }
      return Promise.resolve(answer(url));
    };
    return { fetch, sent };
  }

  test("sends to the members in Bcc, addressed to the sender, so it isn't list mail", async () => {
    const { fetch, sent } = fakeFetch((url) =>
      url.includes(":lookup")
        ? json({ name: "groups/ttp" })
        : json({
            memberships: [
              { preferredMemberKey: { id: "events@example.org" }, type: "USER" },
              { preferredMemberKey: { id: "a@gmail.com" }, type: "USER" },
              { preferredMemberKey: { id: "B@yahoo.com" }, type: "USER" },
            ],
          }),
    );
    const config = mailConfig(env, { outboxDir: "", list: "ttp", fetch });
    const result = await config.send({ from: config.from, to: config.recipients, ...message });
    expect(result).toEqual({ id: "m1", recipients: 2 });
    expect(sent[0]).toContain("To: events@example.org\r\n");
    expect(sent[0]).toContain("Bcc: a@gmail.com, b@yahoo.com\r\n");
    expect(sent[0]).not.toContain("ttp@example.org");
  });

  test(`splits more than ${String(BCC_BATCH)} members over several emails`, async () => {
    const members = Array.from({ length: BCC_BATCH + 1 }, (_, i) => ({
      preferredMemberKey: { id: `p${String(i)}@gmail.com` },
      type: "USER",
    }));
    const { fetch, sent } = fakeFetch((url) =>
      url.includes(":lookup") ? json({ name: "groups/ttp" }) : json({ memberships: members }),
    );
    const config = mailConfig(env, { outboxDir: "", list: "ttp", fetch });
    const result = await config.send({ from: config.from, to: config.recipients, ...message });
    expect(result).toEqual({ id: "m1, m2", recipients: BCC_BATCH + 1 });
    expect(sent).toHaveLength(2);
  });

  test("sends nothing when a group's members can't be read, never to the group itself", async () => {
    const { fetch, sent } = fakeFetch(() =>
      json({ error: { message: "Permission denied for resource (or it may not exist)." } }, 403),
    );
    const config = mailConfig(env, { outboxDir: "", list: "ttp", fetch });
    await expect(
      config.send({ from: config.from, to: config.recipients, ...message }),
    ).rejects.toThrow(/Nothing sent/);
    expect(sent).toHaveLength(0);
  });

  test("the Mail test email goes straight to DEV_EMAILS, a person, without looking up groups", async () => {
    const { fetch, sent } = fakeFetch(() => json({}, 500));
    const config = mailConfig(
      { ...env, DEV_EMAILS: "me@example.org" },
      { outboxDir: "", list: "dev", fetch },
    );
    const result = await config.send({ from: config.from, to: config.recipients, ...message });
    expect(result.recipients).toBe(1);
    expect(sent[0]).toContain("To: me@example.org\r\n");
  });

  test("refuses to send when the group has no one in it", async () => {
    const { fetch } = fakeFetch((url) =>
      url.includes(":lookup") ? json({ name: "groups/ttp" }) : json({}),
    );
    const config = mailConfig(env, { outboxDir: "", list: "ttp", fetch });
    await expect(
      config.send({ from: config.from, to: config.recipients, ...message }),
    ).rejects.toThrow(/no members/);
  });
});

test("test sends like dev and prod, with its own environment's settings (D52)", () => {
  const config = mailConfig({ ...gmail, MAIL_ENV: "test" }, { outboxDir: "", list: "ttp" });
  expect(config.env).toBe("test");
  expect(config.recipients).toEqual(["ttp@example.com"]);
});
