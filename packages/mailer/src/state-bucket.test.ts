import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { SEND_EMAIL } from "@kmcdc/domain";
import { memoryBucket as fakeBucket, WroteFirst } from "@kmcdc/cloud";
import { pullMemory, pushMemory } from "./state-bucket.ts";

// The mail memory in the environment's bucket (D63): pulled before a run, pushed after it,
// never over another run's write.

const dir = () => mkdtemp(path.join(tmpdir(), "mail-memory-"));

test("pulls the memory into the folder under its local names", async () => {
  const bucket = fakeBucket({
    [SEND_EMAIL.state]: { text: '{"a":1}', generation: "7" },
    [SEND_EMAIL.websiteAtLastChangesEmail]: { text: "[]", generation: "3" },
  });
  const d = await dir();
  const pulled = await pullMemory(bucket, d);
  expect(await readFile(path.join(d, "state.json"), "utf8")).toBe('{"a":1}');
  expect(await readFile(path.join(d, "website.json"), "utf8")).toBe("[]");
  expect(pulled[SEND_EMAIL.state]?.generation).toBe("7");
});

test("an empty bucket leaves the folder as it is, and the first push creates the files", async () => {
  const bucket = fakeBucket();
  const d = await dir();
  await writeFile(path.join(d, "state.json"), '{"from":"artifact"}');
  const pulled = await pullMemory(bucket, d);
  expect(await readFile(path.join(d, "state.json"), "utf8")).toBe('{"from":"artifact"}');
  expect(await pushMemory(bucket, d, pulled)).toEqual([SEND_EMAIL.state]);
  expect(bucket.files[SEND_EMAIL.state]?.text).toBe('{"from":"artifact"}');
});

test("pushes only what changed", async () => {
  const bucket = fakeBucket({
    [SEND_EMAIL.state]: { text: '{"a":1}', generation: "7" },
    [SEND_EMAIL.websiteAtLastChangesEmail]: { text: "[]", generation: "3" },
  });
  const d = await dir();
  const pulled = await pullMemory(bucket, d);
  expect(await pushMemory(bucket, d, pulled)).toEqual([]);
  await writeFile(path.join(d, "state.json"), '{"a":2}');
  expect(await pushMemory(bucket, d, pulled)).toEqual([SEND_EMAIL.state]);
  expect(bucket.files[SEND_EMAIL.state]).toMatchObject({ text: '{"a":2}', generation: "8" });
  expect(bucket.files[SEND_EMAIL.websiteAtLastChangesEmail]?.generation).toBe("3");
});

test("a push after another run wrote fails and leaves that run's memory", async () => {
  const bucket = fakeBucket({ [SEND_EMAIL.state]: { text: '{"a":1}', generation: "7" } });
  const d = await dir();
  const pulled = await pullMemory(bucket, d);
  bucket.files[SEND_EMAIL.state] = { text: '{"other":true}', generation: "8" };
  await writeFile(path.join(d, "state.json"), '{"a":2}');
  await expect(pushMemory(bucket, d, pulled)).rejects.toThrow(WroteFirst);
  expect(bucket.files[SEND_EMAIL.state]?.text).toBe('{"other":true}');
});
