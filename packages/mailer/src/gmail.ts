// Sends through the Gmail API with an OAuth refresh token (docs/architecture/email.md).
// Scopes: gmail.send, and reading group members (groups.ts). No credential ever appears in an
// error message.

import { buildMime, type Message } from "./mime.ts";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GmailOptions {
  timeoutMs?: number;
  /** Injected for tests. */
  fetch?: typeof globalThis.fetch;
}

export class MailError extends Error {
  readonly kind: "auth" | "send";

  constructor(message: string, kind: "auth" | "send") {
    super(message);
    this.name = "MailError";
    this.kind = kind;
  }
}

/** Exchanges the stored refresh token for a short-lived access token. */
export async function getAccessToken(
  credentials: GmailCredentials,
  options: GmailOptions = {},
): Promise<string> {
  const { fetch = globalThis.fetch, timeoutMs = 30_000 } = options;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  if (!response.ok || !body.access_token) {
    const reason = body.error ?? `HTTP ${response.status}`;
    throw new MailError(
      `Google refused the Gmail credentials (${reason}). Re-authorise: docs/architecture/email.md §Rotating credentials.`,
      "auth",
    );
  }
  return body.access_token;
}

/** Sends one message; returns Gmail's message id. */
export async function sendGmail(
  message: Message,
  credentials: GmailCredentials,
  options: GmailOptions = {},
): Promise<string> {
  return sendWithToken(message, await getAccessToken(credentials, options), options);
}

/** Sends one message with an access token already in hand; returns Gmail's message id. */
export async function sendWithToken(
  message: Message,
  accessToken: string,
  options: GmailOptions = {},
): Promise<string> {
  const { fetch = globalThis.fetch, timeoutMs = 30_000 } = options;
  const raw = Buffer.from(buildMime(message), "utf8").toString("base64url");
  const response = await fetch(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.id) {
    throw new MailError(
      `Gmail didn't send the message (${response.status}): ${body.error?.message ?? "no detail"}`,
      "send",
    );
  }
  return body.id;
}
