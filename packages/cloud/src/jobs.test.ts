import { expect, test } from "vitest";
import { jobConsoleUrl, jobRuns, runJob, UPDATE_SCHEDULE_JOB } from "./jobs.ts";

// Starting a job and reading its runs (D63), against a fake Cloud Run.

test("starts a job with this run's settings over the job's own", async () => {
  let asked = "";
  let body: unknown;
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    asked = input instanceof Request ? input.url : input.toString();
    body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    return Promise.resolve(
      Response.json({
        metadata: { name: "projects/p/locations/r/jobs/send-email/executions/send-email-abc" },
      }),
    );
  };
  const run = await runJob({
    project: "p",
    region: "r",
    job: "send-email",
    env: { RUN: "update-schedule-xyz" },
    token: () => Promise.resolve("t"),
    fetch,
  });
  expect(run).toBe("send-email-abc");
  expect(asked).toBe("https://run.googleapis.com/v2/projects/p/locations/r/jobs/send-email:run");
  expect(body).toEqual({
    overrides: { containerOverrides: [{ env: [{ name: "RUN", value: "update-schedule-xyz" }] }] },
  });
});

test("a job Google won't start throws, without the token", async () => {
  const fetch = () => Promise.resolve(new Response("", { status: 403 }));
  const error = await runJob({
    project: "p",
    region: "r",
    job: "send-email",
    token: () => Promise.resolve("t0ken"),
    fetch,
  }).catch((e: unknown) => e);
  expect(String(error)).toContain("didn't start send-email (403)");
  expect(String(error)).not.toContain("t0ken");
});

test("a job's runs since a time: when each started, how it ended, its own settings", async () => {
  let asked = "";
  const fetch = (input: string | URL | Request) => {
    asked = input instanceof Request ? input.url : input.toString();
    return Promise.resolve(
      Response.json({
        executions: [
          {
            name: "projects/p/locations/r/jobs/j/executions/j-3",
            createTime: "2026-11-12T04:20:00Z",
          },
          {
            name: "projects/p/locations/r/jobs/j/executions/j-2",
            createTime: "2026-11-12T04:10:00Z",
            completionTime: "2026-11-12T04:11:00Z",
            succeededCount: 1,
            template: {
              containers: [
                { env: [{ name: "FINGERPRINT", value: "wix abc" }, { name: "SECRET" }] },
              ],
            },
          },
          {
            name: "projects/p/locations/r/jobs/j/executions/j-1",
            createTime: "2026-11-12T04:05:00Z",
            completionTime: "2026-11-12T04:06:00Z",
            failedCount: 1,
          },
          {
            name: "projects/p/locations/r/jobs/j/executions/j-0",
            createTime: "2026-11-11T04:07:00Z",
          },
        ],
        nextPageToken: "more",
      }),
    );
  };
  const runs = await jobRuns({
    project: "p",
    region: "r",
    job: "j",
    since: new Date("2026-11-12T00:00:00Z"),
    token: () => Promise.resolve("t"),
    fetch,
  });
  expect(asked).toBe(
    "https://run.googleapis.com/v2/projects/p/locations/r/jobs/j/executions?pageSize=50",
  );
  expect(runs.map((r) => [r.name, r.done, r.succeeded])).toEqual([
    ["j-3", false, false],
    ["j-2", true, true],
    ["j-1", true, false],
  ]);
  expect(runs[1]?.env).toEqual({ FINGERPRINT: "wix abc", SECRET: "" });
  expect(runs[1]?.started).toEqual(new Date("2026-11-12T04:10:00Z"));
});

test("runs Google won't list throw, so the check is tried again", async () => {
  const fetch = () => Promise.resolve(new Response("", { status: 403 }));
  await expect(
    jobRuns({
      project: "p",
      region: "r",
      job: "j",
      since: new Date(0),
      token: () => Promise.resolve("t"),
      fetch,
    }),
  ).rejects.toThrow("didn't list the runs of j (403)");
});

test("a job's page in the console, from the names that start it", () => {
  expect(
    jobConsoleUrl({ project: "your-project-id-dev", region: "us-east4", job: UPDATE_SCHEDULE_JOB }),
  ).toBe(
    "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-dev",
  );
});
