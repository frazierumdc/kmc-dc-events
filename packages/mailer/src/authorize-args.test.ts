import { expect, test } from "vitest";
import {
  describeJobArgs,
  jobSetting,
  parseAuthorizeArgs,
  sendingAddress,
  signedInAs,
  USAGE,
} from "./authorize-args.ts";

test("names the stage's Google project, optionally with the sending account and --new-client (D57, D60)", () => {
  expect(parseAuthorizeArgs(["your-project-id-dev"])).toEqual({
    project: "your-project-id-dev",
    from: null,
    newClient: false,
  });
  expect(parseAuthorizeArgs(["--new-client", "your-project-id"])).toEqual({
    project: "your-project-id",
    from: null,
    newClient: true,
  });
  expect(
    parseAuthorizeArgs([
      "your-project-id-test",
      "--from",
      "sender-test@example.org",
      "--new-client",
    ]),
  ).toEqual({ project: "your-project-id-test", from: "sender-test@example.org", newClient: true });
});

test("anything else shows the usage, so nothing is stored in the wrong project", () => {
  expect(parseAuthorizeArgs([])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["--github"])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["your-project-id-dev", "your-project-id"])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["Not_A_Project"])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["prod"])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["your-project-id-dev", "--from"])).toEqual({ error: USAGE });
  expect(parseAuthorizeArgs(["your-project-id-dev", "--from", "--new-client"])).toEqual({
    error: USAGE,
  });
});

const describedJob = (env: object[]) =>
  JSON.stringify({
    metadata: { name: "send-email" },
    spec: { template: { spec: { template: { spec: { containers: [{ image: "i", env }] } } } } },
  });

test("the sending account comes from the send-email job's own MAIL_FROM setting (D57)", () => {
  const job = describedJob([
    { name: "MAIL_ENV", value: "dev" },
    { name: "MAIL_FROM", value: "Kadampa Meditation Center DC <sender-dev@example.org>" },
    { name: "GMAIL_REFRESH_TOKEN", valueFrom: { secretKeyRef: { name: "GMAIL_REFRESH_TOKEN" } } },
  ]);
  expect(jobSetting(job, "MAIL_FROM")).toBe(
    "Kadampa Meditation Center DC <sender-dev@example.org>",
  );
  expect(sendingAddress(jobSetting(job, "MAIL_FROM"))).toBe("sender-dev@example.org");
  expect(jobSetting(job, "MAIL_ENV")).toBe("dev");
});

test("a job without the setting, a secret's value, or text that isn't a job gives nothing", () => {
  const job = describedJob([
    { name: "GMAIL_REFRESH_TOKEN", valueFrom: { secretKeyRef: { name: "GMAIL_REFRESH_TOKEN" } } },
  ]);
  expect(jobSetting(job, "MAIL_FROM")).toBe("");
  expect(jobSetting(job, "GMAIL_REFRESH_TOKEN")).toBe("");
  expect(jobSetting("{}", "MAIL_FROM")).toBe("");
  expect(jobSetting("", "MAIL_FROM")).toBe("");
  expect(jobSetting("ERROR: (gcloud.run.jobs.describe) Cannot find job", "MAIL_FROM")).toBe("");
});

test("the job is asked for by its name, in the stage's project and the jobs' region", () => {
  expect(describeJobArgs("your-project-id-dev")).toEqual([
    "run",
    "jobs",
    "describe",
    "send-email",
    "--project",
    "your-project-id-dev",
    "--region",
    "us-east4",
    "--format=json",
  ]);
});

const idToken = (claims: object) =>
  ["h", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

test("the account to expect is MAIL_FROM's address, with or without a name", () => {
  expect(sendingAddress("sender-dev@example.org\n")).toBe("sender-dev@example.org");
  expect(sendingAddress("Kadampa Meditation Center DC <Sender@Example.org>")).toBe(
    "sender@example.org",
  );
});

test("who signed in comes from the ID token; anything unreadable is nobody", () => {
  expect(signedInAs(idToken({ email: "Person@example.org" }))).toBe("person@example.org");
  expect(signedInAs(idToken({ sub: "1" }))).toBeNull();
  expect(signedInAs("not-a-token")).toBeNull();
  expect(signedInAs(undefined)).toBeNull();
});
