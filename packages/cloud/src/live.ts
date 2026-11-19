// The live record open apps listen to (NT-1, D64): one value in the stage's Realtime
// Database, the version of the schedule now on the site. Whoever publishes a schedule writes
// it, right after the publish.

/** What the Realtime Database asks of a token. */
export const LIVE_SCOPES = [
  "https://www.googleapis.com/auth/firebase.database",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

/** Writes `version` to the record at `url` (`https://…firebaseio.com/live/version.json`). */
export async function writeLiveVersion(options: {
  url: string;
  version: string;
  token: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}): Promise<void> {
  const { url, version, token, fetch = globalThis.fetch } = options;
  const response = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(version),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`The live record wasn't written (${String(response.status)})`);
}
