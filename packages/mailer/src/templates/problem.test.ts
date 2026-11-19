import { expect, test } from "vitest";
import { problemEmail, type ProblemInput } from "./problem.ts";

// The update job's own reasons (copy-website.ts, copy-cli.ts) and what the email makes of them.

const JOB =
  "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-dev";
const REPOSITORY = "https://github.com/example-org/events-app";
const failed = (problem: string, lastPublishedAt: string | null = "2026-10-16T13:08:50Z") =>
  problemEmail({
    kind: "failed",
    problem,
    failedAt: "2026-10-17T08:07:40Z",
    lastPublishedAt,
    jobUrl: JOB,
    repositoryUrl: REPOSITORY,
  });

test("a refused token: what happened, what it means, what to do (AN-4)", async () => {
  const email = failed(
    "Unreadable: The feed refused the token (403). Check WIX_FEED_TOKEN in Secret Manager against Wix Secrets Manager.",
  );
  expect(email.subject).toBe("Schedule Copy Failed: The Feed Refused the Token");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/problem-token.txt");
  await expect(email.html).toMatchFileSnapshot("__snapshots__/problem-token.html");
});

test.each([
  [
    "Unreadable: No feed at this address (404). Is http-functions.js published?",
    "The Website's Feed Is Missing",
  ],
  [
    "Unreadable: The feed did not return JSON (text/html): <!doctype html>",
    "Couldn't Read the Website",
  ],
  ["Unreadable: Could not reach the feed: fetch failed", "Couldn't Read the Website"],
  [
    "Empty: the source has no events, while the published schedule has 241.",
    "The Website Sent No Events",
  ],
  [
    "Malformed: 30 of 246 events can't be read; the source's format may have changed.",
    "The Website's Data Looks Wrong",
  ],
])("%s → %s", (problem, short) => {
  const email = failed(problem);
  expect(email.subject).toBe(`Schedule Copy Failed: ${short}`);
  expect(email.text).toContain(`Technical detail: ${problem}`);
  expect(email.html).toContain("Technical detail: ");
});

test("before the first publish, the app has nothing to show", () => {
  expect(failed("Unreadable: Could not reach the feed: fetch failed", null).text).toContain(
    "No schedule has been published yet",
  );
});

test("when the last publish isn't known, the app shows the last schedule published", () => {
  const email = problemEmail({
    kind: "failed",
    problem: "Could not read the published schedule at https://example.com (503).",
    failedAt: "2026-10-17T08:07:40Z",
    jobUrl: JOB,
    repositoryUrl: REPOSITORY,
  });
  expect(email.text).toContain("The app still shows the last schedule published.");
});

test("the reason is escaped in HTML", () => {
  expect(failed("Unreadable: The feed did not return JSON (text/html): <script>").html).toContain(
    "&lt;script&gt;",
  );
});

test("works again", async () => {
  const input: ProblemInput = {
    kind: "working",
    workingAt: "2026-10-17T20:07:40Z",
    failingSince: "2026-10-17T08:07:40Z",
    jobUrl: JOB,
  };
  const email = problemEmail(input);
  expect(email.subject).toBe("Schedule Copying Works Again");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/problem-working.txt");
});

test("behind the website (NT-8)", async () => {
  const email = problemEmail({
    kind: "behind",
    since: "2026-11-12T01:45:00Z",
    jobUrl: JOB,
    repositoryUrl: "https://github.com/center/events-app",
  });
  expect(email.subject).toMatch(/^The App Is Behind the Website Since /i);
  expect(email.html).toContain("runbooks.md#the-app-is-behind-the-website");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/problem-behind.txt");
});
