// The live connection (NT-1, D64): one record in the stage's Realtime Database holds the
// version of the schedule last published. An open app listens to it with the browser's own
// EventSource, so a publish is heard within seconds. The record says only that there is
// something new: the schedule itself always comes from the site (NT-3).

/** As much of EventSource as the listener uses, so tests can stand in for it. */
export interface LiveSource {
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  close(): void;
}

export type OpenLiveSource = (url: string) => LiveSource;

/** The browser's EventSource; null where there is none. */
export const browserSource: OpenLiveSource | null =
  typeof EventSource === "undefined" ? null : (url) => new EventSource(url);

/** The version in one of the database's messages, or null when it carries none. */
export function liveVersion(data: string): string | null {
  try {
    const message = JSON.parse(data) as { path?: unknown; data?: unknown } | null;
    return message?.path === "/" && typeof message.data === "string" && message.data !== ""
      ? message.data
      : null;
  } catch {
    return null;
  }
}

/**
 * Listens to the record at `url` and calls `onVersion` with the version it holds: once on
 * connecting, again on every publish, and on every reconnect, which the browser does by
 * itself. Returns what stops it.
 */
export function listenLive(
  url: string,
  onVersion: (version: string) => void,
  open: OpenLiveSource | null = browserSource,
): () => void {
  if (!url || !open) return () => undefined;
  let source: LiveSource;
  try {
    source = open(url);
  } catch {
    return () => undefined;
  }
  source.addEventListener("put", (event) => {
    const version = liveVersion(event.data);
    if (version) onVersion(version);
  });
  return () => {
    source.close();
  };
}
