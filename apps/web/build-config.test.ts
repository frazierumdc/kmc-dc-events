import { expect, test } from "vitest";
import { readBuildConfig, SITES } from "./build-config.ts";

test("with nothing set: a local build of the real app, no live record, no notifications", () => {
  expect(readBuildConfig({})).toEqual({
    buildId: "local",
    killSwitch: false,
    appEnv: "prod",
    site: SITES.prod,
    liveUrl: "",
    push: null,
  });
});

test.each([
  ["dev", "dev"],
  ["test", "test"],
  ["prod", "prod"],
  ["staging", "prod"],
  ["", "prod"],
] as const)("APP_ENV=%s builds the %s app, with that stage's address", (value, appEnv) => {
  const config = readBuildConfig({ APP_ENV: value });
  expect(config.appEnv).toBe(appEnv);
  expect(config.site).toBe(SITES[appEnv]);
});

test("only KILL_SWITCH=1 builds the kill switch", () => {
  expect(readBuildConfig({ KILL_SWITCH: "1" }).killSwitch).toBe(true);
  expect(readBuildConfig({ KILL_SWITCH: "true" }).killSwitch).toBe(false);
});

test("the deploy's build id, live record and notification settings are read as they are", () => {
  const config = readBuildConfig({
    BUILD_ID: "abc1234",
    LIVE_URL: "https://live.example.org/version.json",
    WEB_APP_CONFIG: JSON.stringify({
      apiKey: "key",
      appId: "app",
      messagingSenderId: "1",
      projectId: "your-project-id-dev",
    }),
    PUSH_PUBLIC_KEY: "public-key",
  });
  expect(config.buildId).toBe("abc1234");
  expect(config.liveUrl).toBe("https://live.example.org/version.json");
  expect(config.push).toMatchObject({ projectId: "your-project-id-dev", vapidKey: "public-key" });
});

test("malformed notification settings stop the build", () => {
  expect(() => readBuildConfig({ WEB_APP_CONFIG: "{", PUSH_PUBLIC_KEY: "k" })).toThrow(
    "WEB_APP_CONFIG isn't JSON",
  );
});
