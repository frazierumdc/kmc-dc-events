import { expect, test } from "vitest";
import { cloudBucket, WroteFirst } from "./bucket.ts";

// The bucket (D63), against a fake Cloud Storage.

test("Cloud Storage: reads a file with its version, null when there is none", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const answers = [
    new Response('{"a":1}', { headers: { "x-goog-generation": "42" } }),
    new Response("", { status: 404 }),
  ];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return Promise.resolve(answers.shift() ?? new Response("", { status: 500 }));
  };
  const bucket = cloudBucket({ bucket: "b", token: () => Promise.resolve("t0ken"), fetch });
  expect(await bucket.read("send-email/state.json")).toEqual({ text: '{"a":1}', generation: "42" });
  expect(await bucket.read("send-email/state.json")).toBeNull();
  expect(calls[0]?.url).toBe(
    "https://storage.googleapis.com/storage/v1/b/b/o/send-email%2Fstate.json?alt=media",
  );
  expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer t0ken");
});

test("Cloud Storage: writes only over the version read; 412 is WroteFirst", async () => {
  const calls: string[] = [];
  const answers = [new Response("{}"), new Response("", { status: 412 })];
  const fetch = (input: string | URL | Request) => {
    calls.push(input instanceof Request ? input.url : input.toString());
    return Promise.resolve(answers.shift() ?? new Response("", { status: 500 }));
  };
  const bucket = cloudBucket({ bucket: "b", token: () => Promise.resolve("t"), fetch });
  await bucket.write("send-email/state.json", "{}", "42");
  expect(calls[0]).toBe(
    "https://storage.googleapis.com/upload/storage/v1/b/b/o?uploadType=media&name=send-email%2Fstate.json&ifGenerationMatch=42",
  );
  await expect(bucket.write("send-email/state.json", "{}", "42")).rejects.toThrow(WroteFirst);
  await expect(bucket.write("send-email/state.json", "{}", "42")).rejects.toThrow("(500)");
});

test("Cloud Storage: deletes only the version read; a file already gone is fine", async () => {
  const calls: string[] = [];
  const answers = [new Response(null, { status: 204 }), new Response("", { status: 404 })];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push(
      `${init?.method ?? "GET"} ${input instanceof Request ? input.url : input.toString()}`,
    );
    return Promise.resolve(answers.shift() ?? new Response("", { status: 412 }));
  };
  const bucket = cloudBucket({ bucket: "b", token: () => Promise.resolve("t"), fetch });
  await bucket.remove("update-schedule/lock.json", "7");
  await bucket.remove("update-schedule/lock.json", "7");
  await expect(bucket.remove("update-schedule/lock.json", "7")).rejects.toThrow(WroteFirst);
  expect(calls[0]).toBe(
    "DELETE https://storage.googleapis.com/storage/v1/b/b/o/update-schedule%2Flock.json?ifGenerationMatch=7",
  );
});

test("Cloud Storage: a failure that isn't a version clash names the file, the bucket and the status", async () => {
  const bucket = cloudBucket({
    bucket: "state",
    token: () => Promise.resolve("t"),
    fetch: () => Promise.resolve(new Response("down", { status: 503 })),
  });
  await expect(bucket.read("a.json")).rejects.toThrow("Could not read a.json from state (503)");
  await expect(bucket.write("a.json", "{}", "0")).rejects.toThrow(
    "Could not write a.json to state (503)",
  );
  await expect(bucket.remove("a.json", "1")).rejects.toThrow(
    "Could not delete a.json from state (503)",
  );
});

test("Cloud Storage: a file that comes without its version is refused", async () => {
  const bucket = cloudBucket({
    bucket: "state",
    token: () => Promise.resolve("t"),
    fetch: () => Promise.resolve(new Response("{}", { status: 200 })),
  });
  await expect(bucket.read("a.json")).rejects.toThrow("came without its version");
});

test("Cloud Storage: a file comes with when it was last written, when the bucket says", async () => {
  const bucket = cloudBucket({
    bucket: "state",
    token: () => Promise.resolve("t"),
    fetch: () =>
      Promise.resolve(
        new Response("{}", {
          headers: {
            "x-goog-generation": "42",
            "last-modified": "Thu, 12 Nov 2026 03:40:00 GMT",
          },
        }),
      ),
  });
  expect(await bucket.read("update-schedule/lock.json")).toEqual({
    text: "{}",
    generation: "42",
    updated: "2026-11-12T03:40:00.000Z",
  });
});
