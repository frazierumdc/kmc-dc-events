import path from "node:path";
import { expect, test } from "vitest";
import { readCliSettings } from "./cli-settings.ts";

const ROOT = "/repo";

test("with nothing set: files at the repository root, no bucket, no run", () => {
  expect(readCliSettings({}, ROOT, "/work")).toEqual({
    cwd: "/work",
    outboxDir: path.join(ROOT, ".outbox"),
    stateFile: path.join(ROOT, ".mail-state/state.json"),
    stateBucket: undefined,
    mailSettings: undefined,
    publishedUrl: undefined,
    runUrl: undefined,
    updateJobUrl: "https://console.cloud.google.com/run/jobs",
  });
});

test("the memory's file is relative to where pnpm was run", () => {
  const settings = readCliSettings(
    { INIT_CWD: "/repo/sub", MAIL_STATE_FILE: "state/mail.json", MAIL_OUTBOX: "/out" },
    ROOT,
    "/work",
  );
  expect(settings.cwd).toBe("/repo/sub");
  expect(settings.stateFile).toBe(path.resolve("/repo/sub", "state/mail.json"));
  expect(settings.outboxDir).toBe("/out");
});

test("a job on Google names its own log", () => {
  expect(
    readCliSettings(
      {
        RUN_URL: "https://console.example.org/run/1",
        GITHUB_REPOSITORY: "o/r",
      },
      ROOT,
      "/",
    ).runUrl,
  ).toBe("https://console.example.org/run/1");
});

test("a job on Google: the Update schedule job's page, from the stage's project and region", () => {
  const settings = readCliSettings(
    { PROJECT: "your-project-id-test", REGION: "us-east4", JOB: "send-email" },
    ROOT,
    "/",
  );
  expect(settings.updateJobUrl).toBe(
    "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-test",
  );
  // One of the two alone names no job: the console's list of jobs.
  expect(readCliSettings({ PROJECT: "your-project-id-test" }, ROOT, "/").updateJobUrl).toBe(
    "https://console.cloud.google.com/run/jobs",
  );
});
