import { describe, expect, test } from "vitest";
import { MailError, TOKEN_URL, getAccessToken, sendGmail } from "./gmail.ts";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret-not-real",
  refreshToken: "refresh-token-not-real",
};
const message = {
  from: "KMC DC Events App <app@example.com>",
  to: ["admin@example.com"],
  subject: "Test",
  text: "Hello",
};

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(...answers: Response[]) {
  const calls: Call[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    const answer = answers.shift();
    return answer ? Promise.resolve(answer) : Promise.reject(new Error("no more answers"));
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function mailError(promise: Promise<unknown>): Promise<MailError> {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(MailError);
  return error as MailError;
}

describe("getAccessToken", () => {
  test("exchanges the refresh token", async () => {
    const { fetch, calls } = fakeFetch(json({ access_token: "access" }));
    expect(await getAccessToken(credentials, { fetch })).toBe("access");
    expect(calls[0]?.url).toBe(TOKEN_URL);
    const form = calls[0]?.init?.body as URLSearchParams;
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe(credentials.refreshToken);
  });

  test("a revoked token says how to fix it, without showing any credential", async () => {
    const { fetch } = fakeFetch(json({ error: "invalid_grant" }, 400));
    const error = await mailError(getAccessToken(credentials, { fetch }));
    expect(error.kind).toBe("auth");
    expect(error.message).toContain("invalid_grant");
    expect(error.message).toContain("Re-authorise");
    for (const secret of Object.values(credentials)) expect(error.message).not.toContain(secret);
  });
});

describe("sendGmail", () => {
  test("posts the message, base64url-encoded, with the access token", async () => {
    const { fetch, calls } = fakeFetch(json({ access_token: "access" }), json({ id: "msg-1" }));
    expect(await sendGmail(message, credentials, { fetch })).toBe("msg-1");
    const send = calls[1];
    expect(send?.url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(new Headers(send?.init?.headers).get("authorization")).toBe("Bearer access");
    const { raw } = JSON.parse(send?.init?.body as string) as { raw: string };
    expect(raw).not.toMatch(/[+/=]/);
    expect(Buffer.from(raw, "base64url").toString("utf8")).toContain("To: admin@example.com");
  });

  test("reports Gmail's reason when sending fails", async () => {
    const { fetch } = fakeFetch(
      json({ access_token: "access" }),
      json({ error: { message: "Daily sending quota exceeded" } }, 429),
    );
    const error = await mailError(sendGmail(message, credentials, { fetch }));
    expect(error.kind).toBe("send");
    expect(error.message).toContain("Daily sending quota exceeded");
  });
});
