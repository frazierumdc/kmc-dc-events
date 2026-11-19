// Reads the Wix feed (docs/architecture/wix-feed.md): one GET with the bearer token, a
// timeout, and retries on 429, 5xx, network errors and a reply that isn't JSON. The token
// never appears in errors.

import { FeedEnvelope } from "@kmcdc/domain";
import { FEED_URL } from "./deployment.ts";

export interface FetchFeedOptions {
  token: string;
  /** Defaults to the live site's feed. */
  url?: string;
  /** Call the Wix test site (`?rc=test-site`) instead of the live one. */
  testSite?: boolean;
  /** Retries after the first attempt. */
  maxRetries?: number;
  timeoutMs?: number;
  /** Injected for tests. */
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

export type FeedErrorKind = "auth" | "notFound" | "server" | "network" | "badResponse";

export class FeedError extends Error {
  readonly kind: FeedErrorKind;
  readonly status: number | undefined;

  constructor(message: string, kind: FeedErrorKind, status?: number) {
    super(message);
    this.name = "FeedError";
    this.kind = kind;
    this.status = status;
  }
}

const MAX_RETRY_AFTER_MS = 30_000;

/** Fetches and checks the feed's envelope. Each event is still `unknown`; parse it with `WixEvent`. */
export async function fetchFeed(options: FetchFeedOptions): Promise<FeedEnvelope> {
  const {
    token,
    maxRetries = 3,
    timeoutMs = 30_000,
    fetch = globalThis.fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;
  const url = new URL(options.url ?? FEED_URL);
  if (options.testSite) url.searchParams.set("rc", "test-site");

  for (let attempt = 0; ; attempt++) {
    const retry = async (waitMs?: number) => {
      if (attempt >= maxRetries) return false;
      await sleep(waitMs ?? 1000 * 2 ** attempt);
      return true;
    };

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (await retry()) continue;
      throw new FeedError(`Could not reach the feed: ${(error as Error).message}`, "network");
    }

    if (response.ok) {
      const text = await response.text();
      const json = parseJson(text);
      if (json !== NOT_JSON) return parseEnvelope(json);
      if (await retry()) continue;
      const type = response.headers.get("content-type") ?? "no content type";
      const start = text.replaceAll(token, "…").replace(/\s+/g, " ").trim().slice(0, 200);
      throw new FeedError(`The feed did not return JSON (${type}): ${start}`, "badResponse");
    }

    if (response.status === 403) {
      throw new FeedError(
        "The feed refused the token (403). Check WIX_FEED_TOKEN in Secret Manager against Wix Secrets Manager.",
        "auth",
        403,
      );
    }
    if (response.status === 404) {
      throw new FeedError(
        "No feed at this address (404). Is http-functions.js published?",
        "notFound",
        404,
      );
    }
    if (response.status === 429 || response.status >= 500) {
      if (await retry(retryAfterMs(response.headers.get("retry-after")))) continue;
      const detail = await response.text().catch(() => "");
      throw new FeedError(
        `The feed failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        "server",
        response.status,
      );
    }
    throw new FeedError(
      `Unexpected response from the feed (${response.status})`,
      "badResponse",
      response.status,
    );
  }
}

const NOT_JSON = Symbol("not JSON");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

function parseEnvelope(json: unknown): FeedEnvelope {
  const parsed = FeedEnvelope.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "(root)";
    throw new FeedError(
      `The feed's response has an unexpected shape: ${where} ${issue?.message ?? ""}`,
      "badResponse",
    );
  }
  return parsed.data;
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : undefined;
}
