import { expect, test } from "vitest";
import { LIVE_SCOPES, writeLiveVersion } from "./live.ts";
import { sendMessage } from "./messages.ts";
import { accessToken } from "./token.ts";

// The token, the live record and messaging, each against a fake Google.

test("the access token: the one supplied, else the job's own from the metadata server", async () => {
  expect(await accessToken({ GOOGLE_OAUTH_ACCESS_TOKEN: "given" })).toBe("given");
  let asked = "";
  const fetch = (input: string | URL | Request) => {
    asked = input instanceof Request ? input.url : input.toString();
    return Promise.resolve(Response.json({ access_token: "from-metadata" }));
  };
  expect(await accessToken({}, fetch)).toBe("from-metadata");
  expect(asked).toContain("metadata.google.internal");
});

test("the live record: the version written as its one value, with a token for the database", async () => {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      method: init?.method,
      body: init?.body,
    });
    return Promise.resolve(
      calls.length === 1 ? Response.json({ access_token: "scoped" }) : Response.json("v2"),
    );
  };
  await writeLiveVersion({
    url: "https://db.example/live/version.json",
    version: "v2",
    token: () => accessToken({}, fetch, LIVE_SCOPES),
    fetch,
  });
  expect(calls[0]?.url).toContain(
    "/token?scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Ffirebase.database%2C",
  );
  expect(calls[1]).toMatchObject({
    url: "https://db.example/live/version.json",
    method: "PUT",
    body: '"v2"',
  });
});

test("a live record that refuses the write throws", async () => {
  const fetch = () => Promise.resolve(new Response("", { status: 401 }));
  await expect(
    writeLiveVersion({
      url: "https://db.example/x.json",
      version: "v",
      token: () => Promise.resolve("t"),
      fetch,
    }),
  ).rejects.toThrow("wasn't written (401)");
});

// Sending a notification (D65): one POST per list; the token never appears in errors.
const sendBody = {
  message: {
    topic: "type-class" as const,
    webpush: {
      headers: { TTL: "3600", Urgency: "high" as const },
      data: { title: "Test", body: "Body", url: "/", tag: "test" },
    },
  },
};

test("Messaging: sends to one list and returns the message's name", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return Promise.resolve(Response.json({ name: "projects/p/messages/1" }));
  };
  const name = await sendMessage({
    project: "p",
    body: sendBody,
    token: () => Promise.resolve("t0ken"),
    fetch,
  });
  expect(name).toBe("projects/p/messages/1");
  expect(calls[0]?.url).toBe("https://fcm.googleapis.com/v1/projects/p/messages:send");
  expect(JSON.parse(calls[0]?.init?.body as string)).toEqual(sendBody);
});

test("Messaging: a refusal names the list and the status, never the token", async () => {
  const fetch = () => Promise.resolve(new Response("PERMISSION_DENIED", { status: 403 }));
  const error = await sendMessage({
    project: "p",
    body: sendBody,
    token: () => Promise.resolve("t0ken"),
    fetch,
  }).catch((e: unknown) => e as Error);
  expect(String(error)).toContain("type-class (403) PERMISSION_DENIED");
  expect(String(error)).not.toContain("t0ken");
});
