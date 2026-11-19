import { expect, test } from "vitest";
import { projectEnvironment, SEND_EMAIL, stateBucketName, UPDATE_SCHEDULE } from "./state-paths.ts";

test("each project's bucket is named for its environment (D63)", () => {
  expect(stateBucketName("your-project-id-dev")).toBe("your-project-id-dev-state");
  expect(stateBucketName("your-project-id-test")).toBe("your-project-id-test-state");
  expect(stateBucketName("your-project-id")).toBe("your-project-id-prod-state");
  expect(projectEnvironment("your-project-id")).toBe("prod");
});

test("each job keeps to its own folder, and no two files share a name", () => {
  const names = [...Object.values(SEND_EMAIL)];
  expect(names.every((n) => n.startsWith("send-email/"))).toBe(true);
  expect(new Set(names.map((n) => n.split("/").at(-1))).size).toBe(names.length);
  expect(UPDATE_SCHEDULE.handOver("abc")).toBe("update-schedule/runs/abc/hand-over.json");
  expect(UPDATE_SCHEDULE.lock.startsWith("update-schedule/")).toBe(true);
});
