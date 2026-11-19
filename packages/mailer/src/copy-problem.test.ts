import { expect, test } from "vitest";
import { reportProblem, reportWorking } from "./copy-problem.ts";
import { MailState } from "./mail-state.ts";

// The Problem email's once-a-day rule (AN-4) against the mail memory.

const problem = (state: MailState, now: string, send = () => Promise.resolve()) =>
  reportProblem({ state, now: new Date(now), send });

test("the first failure records it and emails", async () => {
  const state = MailState.parse({});
  let sent = 0;
  expect(
    await problem(state, "2026-10-17T08:07:40Z", () => {
      sent++;
      return Promise.resolve();
    }),
  ).toBe("emailed");
  expect(sent).toBe(1);
  expect(state.problem).toEqual({
    since: "2026-10-17T08:07:40.000Z",
    emailedAt: "2026-10-17T08:07:40.000Z",
  });
});

test("failures within 24 hours of the last email send nothing; after, one more", async () => {
  const state = MailState.parse({});
  await problem(state, "2026-10-17T08:07:40Z");
  let sent = 0;
  const count = () => {
    sent++;
    return Promise.resolve();
  };
  expect(await problem(state, "2026-10-17T20:07:40Z", count)).toBe("skipped");
  expect(await problem(state, "2026-10-18T08:07:39Z", count)).toBe("skipped");
  expect(sent).toBe(0);
  expect(await problem(state, "2026-10-18T08:07:41Z", count)).toBe("emailed");
  expect(sent).toBe(1);
  expect(state.problem).toEqual({
    since: "2026-10-17T08:07:40.000Z",
    emailedAt: "2026-10-18T08:07:41.000Z",
  });
});

test("a failed send is recorded as not emailed, so the next run tries again", async () => {
  const state = MailState.parse({});
  await expect(
    problem(state, "2026-10-17T08:07:40Z", () => Promise.reject(new Error("Gmail down"))),
  ).rejects.toThrow("Gmail down");
  expect(state.problem).toEqual({ since: "2026-10-17T08:07:40.000Z", emailedAt: null });
  expect(await problem(state, "2026-10-17T20:07:40Z")).toBe("emailed");
});

test("the first good copy clears the record and emails since when it failed", async () => {
  const state = MailState.parse({});
  await problem(state, "2026-10-17T08:07:40Z");
  let since = "";
  expect(
    await reportWorking({
      state,
      send: (failingSince) => {
        since = failingSince;
        return Promise.resolve();
      },
    }),
  ).toBe("emailed");
  expect(since).toBe("2026-10-17T08:07:40.000Z");
  expect(state.problem).toBeNull();
});

test("a good copy while nothing failed sends nothing", async () => {
  const state = MailState.parse({});
  let sent = 0;
  expect(
    await reportWorking({
      state,
      send: () => {
        sent++;
        return Promise.resolve();
      },
    }),
  ).toBe("none");
  expect(sent).toBe(0);
});
