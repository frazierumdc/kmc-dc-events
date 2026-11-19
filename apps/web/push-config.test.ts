import { expect, test } from "vitest";
import { pushConfig } from "./push-config.ts";

// The stage's messaging settings, read at build time (D65): both or neither, never half.
const CONFIG = JSON.stringify({
  apiKey: "AIzaSyExample-key_1",
  appId: "1:123456789012:web:0123abcd",
  messagingSenderId: "123456789012",
  projectId: "your-project-id-dev",
});
const KEY = "BExampleWebPushKey-abc_123";

test("the web app's settings and the web push key make the app's settings", () => {
  expect(pushConfig(CONFIG, ` ${KEY}\n`)).toEqual({
    apiKey: "AIzaSyExample-key_1",
    appId: "1:123456789012:web:0123abcd",
    messagingSenderId: "123456789012",
    projectId: "your-project-id-dev",
    vapidKey: KEY,
  });
});

test("without either, the app has no notifications", () => {
  expect(pushConfig()).toBeNull();
  expect(pushConfig(CONFIG, "")).toBeNull();
  expect(pushConfig("", KEY)).toBeNull();
});

test("a malformed setting stops the build", () => {
  expect(() => pushConfig("{apiKey", KEY)).toThrow("WEB_APP_CONFIG isn't JSON");
  expect(() => pushConfig(JSON.stringify({ apiKey: "x" }), KEY)).toThrow("no good appId");
  expect(() => pushConfig(CONFIG, "key with spaces")).toThrow("no good vapidKey");
});
