// Sends one message through Firebase Cloud Messaging's HTTP v1 API (D65): one POST per list.
// The token never appears in errors.

import type { FcmSend } from "@kmcdc/domain";

/** What sending needs: Google's OAuth scope for messaging. */
export const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export interface SendMessageOptions {
  project: string;
  body: FcmSend;
  token: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}

/** Sends the message and returns its name, `projects/<project>/messages/<id>`. */
export async function sendMessage(options: SendMessageOptions): Promise<string> {
  const { project, body, token, fetch = globalThis.fetch } = options;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const why = await response.text().catch(() => "");
    throw new Error(
      `Firebase didn't send to ${"topic" in body.message ? body.message.topic : body.message.condition} (${String(response.status)}) ${why.slice(0, 300)}`,
    );
  }
  return ((await response.json()) as { name: string }).name;
}
