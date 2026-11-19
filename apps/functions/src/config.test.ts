import { expect, test } from "vitest";
import { APP_ORIGINS, readFunctionsConfig, REGION } from "./config.ts";

test("the stage's site, origins and accounts all come from the project Firebase names", () => {
  const config = readFunctionsConfig({ GCLOUD_PROJECT: "your-project-id-dev" });
  expect(config.project).toBe("your-project-id-dev");
  expect(config.region).toBe(REGION);
  expect(config.site).toBe("https://your-project-id-dev.web.app");
  expect(config.appOrigins).toEqual([
    "https://your-project-id-dev.web.app",
    "https://your-project-id-dev.firebaseapp.com",
    APP_ORIGINS,
  ]);
  expect(config.serviceAccount("notify-lists")).toBe(
    "notify-lists@your-project-id-dev.iam.gserviceaccount.com",
  );
});

test("with no project the names are still formed, as when the module is only loaded", () => {
  const config = readFunctionsConfig({});
  expect(config.project).toBe("");
  expect(config.site).toBe("https://.web.app");
});

test.each([
  ["https://events.example.org", true],
  ["https://events.dev.example.org", true],
  ["https://events.test.example.org", true],
  ["https://events.example.org.evil.example", false],
  ["http://events.example.org", false],
  ["https://events.staging.example.org", false],
])("the app's own address %s is answered: %s", (origin, allowed) => {
  expect(APP_ORIGINS.test(origin)).toBe(allowed);
});
