import { expect, test } from "vitest";
import { readJobConfig } from "./config.ts";

test("with nothing set: the default work directory, no trigger, nothing asked of send-email", () => {
  const config = readJobConfig({});
  expect(config.workDir).toBe("/tmp/job");
  expect(config.execution).toBeUndefined();
  expect(config.trigger).toBe("");
  expect(config.liveUrl).toBeUndefined();
  expect(config.email).toEqual({
    run: undefined,
    email: undefined,
    to: undefined,
    scheduled: false,
    since: undefined,
  });
});

test("the job's own settings are read as they are", () => {
  const env = {
    JOB_WORK_DIR: "/work",
    CLOUD_RUN_EXECUTION: "update-schedule-abc12",
    TRIGGER: "wix",
    LIVE_URL: "https://live.example.org/version.json",
    RUN: "update-schedule-abc12",
    EMAIL: "events",
    TO: "me",
    SCHEDULED: "true",
    SINCE: "2026-10-16T08:00:00Z",
  };
  const config = readJobConfig(env);
  expect(config).toMatchObject({
    workDir: "/work",
    execution: "update-schedule-abc12",
    trigger: "wix",
    liveUrl: "https://live.example.org/version.json",
    email: {
      run: "update-schedule-abc12",
      email: "events",
      to: "me",
      scheduled: true,
      since: "2026-10-16T08:00:00Z",
    },
  });
  expect(config.env).toBe(env);
});

test("only SCHEDULED=true is a scheduled send", () => {
  expect(readJobConfig({ SCHEDULED: "1" }).email.scheduled).toBe(false);
});

test("a required setting is checked when it is read, and the error names it", () => {
  const config = readJobConfig({ JOB: "send-email", STATE_BUCKET: "" });
  expect(config.need("JOB")).toBe("send-email");
  expect(() => config.need("STATE_BUCKET")).toThrow("The job has no STATE_BUCKET setting.");
  expect(() => config.need("PROJECT")).toThrow("The job has no PROJECT setting.");
});
