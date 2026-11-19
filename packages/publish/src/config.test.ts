import { expect, test } from "vitest";
import { readPublishSettings } from "./config.ts";

test("with nothing set: the process's directory, the job's own sign-in, no quota project", () => {
  expect(readPublishSettings({}, "/work")).toEqual({
    cwd: "/work",
    accessToken: undefined,
    quotaProject: undefined,
  });
});

test("relative paths start where pnpm was run", () => {
  expect(readPublishSettings({ INIT_CWD: "/repo" }, "/work").cwd).toBe("/repo");
});

test("a supplied token and quota project are read as they are; an empty token is no token", () => {
  expect(
    readPublishSettings(
      {
        GOOGLE_OAUTH_ACCESS_TOKEN: "not-a-real-token",
        GOOGLE_CLOUD_QUOTA_PROJECT: "your-project-id-dev",
      },
      "/",
    ),
  ).toMatchObject({ accessToken: "not-a-real-token", quotaProject: "your-project-id-dev" });
  expect(readPublishSettings({ GOOGLE_OAUTH_ACCESS_TOKEN: "" }, "/").accessToken).toBeUndefined();
});
