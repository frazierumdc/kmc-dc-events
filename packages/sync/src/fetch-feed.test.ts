import { describe, expect, test } from "vitest";
import sample from "../fixtures/feed-sample.json" with { type: "json" };
import { FEED_URL } from "./deployment.ts";
import { FeedError, fetchFeed } from "./fetch-feed.ts";

const TOKEN = "test-token-not-real";

/** A fake fetch that answers with the given responses in turn and records each call. */
function fakeFetch(...answers: (Response | Error)[]) {
  const calls: { url: string; headers: Headers }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      headers: new Headers(init?.headers),
    });
    const answer = answers.shift();
    if (!answer) throw new Error("no more answers");
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

const noSleep = { sleep: () => Promise.resolve() };

async function feedError(promise: Promise<unknown>): Promise<FeedError> {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(FeedError);
  return error as FeedError;
}

describe("fetchFeed", () => {
  test("sends the bearer token to the live feed and returns the envelope", async () => {
    const { fetch, calls } = fakeFetch(json(sample));
    const feed = await fetchFeed({ token: TOKEN, fetch });
    expect(feed.count).toBe(5);
    expect(feed.events).toHaveLength(5);
    expect(calls[0]?.url).toBe(FEED_URL);
    expect(calls[0]?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  test("calls the Wix test site when asked", async () => {
    const { fetch, calls } = fakeFetch(json(sample));
    await fetchFeed({ token: TOKEN, fetch, testSite: true });
    expect(calls[0]?.url).toBe(`${FEED_URL}?rc=test-site`);
  });

  test("retries 429, 5xx and network errors, then succeeds", async () => {
    const waits: number[] = [];
    const { fetch, calls } = fakeFetch(
      json({}, 429, { "retry-after": "2" }),
      new TypeError("fetch failed"),
      json({ error: "Could not read events" }, 500),
      json(sample),
    );
    const feed = await fetchFeed({
      token: TOKEN,
      fetch,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(feed.count).toBe(5);
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([2000, 2000, 4000]);
  });

  test("gives up after three retries and reports Wix's detail", async () => {
    const failure = () => json({ error: "Could not read events", detail: "query refused" }, 500);
    const { fetch, calls } = fakeFetch(failure(), failure(), failure(), failure());
    const error = await feedError(fetchFeed({ token: TOKEN, fetch, ...noSleep }));
    expect(calls).toHaveLength(4);
    expect(error.kind).toBe("server");
    expect(error.message).toContain("query refused");
  });

  test("does not retry a refused token, and never shows the token", async () => {
    const { fetch, calls } = fakeFetch(json({ error: "Not authorised" }, 403));
    const error = await feedError(fetchFeed({ token: TOKEN, fetch, ...noSleep }));
    expect(calls).toHaveLength(1);
    expect(error.kind).toBe("auth");
    expect(error.message).not.toContain(TOKEN);
  });

  test("reports an unpublished feed", async () => {
    const { fetch } = fakeFetch(new Response("Not found", { status: 404 }));
    expect((await feedError(fetchFeed({ token: TOKEN, fetch }))).kind).toBe("notFound");
  });

  test("rejects a response that isn't the feed's envelope", async () => {
    const { fetch } = fakeFetch(json({ ...sample, access: "admin" }));
    const error = await feedError(fetchFeed({ token: TOKEN, fetch }));
    expect(error.kind).toBe("badResponse");
    expect(error.message).toContain("access");
  });

  test("retries a response that isn't JSON, then succeeds", async () => {
    const { fetch, calls } = fakeFetch(new Response("<html>", { status: 200 }), json(sample));
    const feed = await fetchFeed({ token: TOKEN, fetch, ...noSleep });
    expect(feed.count).toBe(5);
    expect(calls).toHaveLength(2);
  });

  test("gives up on a response that isn't JSON and says what came back, without the token", async () => {
    const page = () =>
      new Response(
        `<!doctype html>\n<html>  <title>Site busy</title> ${TOKEN} ${"x".repeat(400)}`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    const { fetch, calls } = fakeFetch(page(), page(), page(), page());
    const error = await feedError(fetchFeed({ token: TOKEN, fetch, ...noSleep }));
    expect(calls).toHaveLength(4);
    expect(error.kind).toBe("badResponse");
    expect(error.message).toContain("The feed did not return JSON (text/html; charset=utf-8)");
    expect(error.message).toContain("<!doctype html> <html> <title>Site busy</title>");
    expect(error.message).not.toContain(TOKEN);
    expect(error.message.length).toBeLessThan(300);
  });

  test("stops waiting after the timeout", async () => {
    const hang: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason as Error);
        });
      });
    const error = await feedError(
      fetchFeed({ token: TOKEN, fetch: hang, timeoutMs: 10, maxRetries: 0 }),
    );
    expect(error.kind).toBe("network");
  });
});
