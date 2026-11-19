// One run at a time per project (D63): a job takes a lock file in its own folder of the
// bucket before it works and removes it after. A run that finds the lock waits for it; a
// lock left by a run that died is taken over once it is older than any run can be. A lock
// file that can't be read is damaged: its age is then the file's own, when it was last
// written, and it is taken over by the same rule, with a warning.

import { WroteFirst, type Bucket } from "./bucket.ts";

export interface LockOptions {
  bucket: Bucket;
  /** The lock's file, in the job's own folder. */
  name: string;
  /** Who holds it, for the log: the run's name. */
  holder: string;
  /** A lock older than this was left behind. */
  staleMs?: number;
  /** How long to wait for another run before giving up. */
  waitMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

interface LockFile {
  holder: string;
  at: string;
}

/** Takes the lock, waiting for another run if need be; returns what releases it. */
export async function takeLock(options: LockOptions): Promise<() => Promise<void>> {
  const {
    bucket,
    name,
    holder,
    staleMs = 20 * 60_000,
    waitMs = 15 * 60_000,
    pollMs = 5_000,
    now = Date.now,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    log = () => undefined,
  } = options;
  const started = now();
  let said = false;
  for (;;) {
    const held = await bucket.read(name);
    let over = "0";
    if (held) {
      const lock = parse(held.text);
      const damaged = Number.isNaN(Date.parse(lock.at));
      // A damaged lock says nothing of its own: the file's last write stands in for it. With
      // no time from either, the age is unknown and the run waits, never assuming.
      const since = damaged ? (held.updated ?? "") : lock.at;
      const age = now() - Date.parse(since);
      if (!(age >= staleMs)) {
        if (now() - started >= waitMs)
          throw new Error(`Another run (${lock.holder}) still holds ${name}; gave up waiting.`);
        if (!said) log(`Waiting for another run (${lock.holder}) to finish.`);
        said = true;
        await sleep(pollMs);
        continue;
      }
      log(
        damaged
          ? `Warning: the lock file ${name} can't be read; taking it over, as it was last written at ${since}.`
          : `Taking over a lock left by ${lock.holder} at ${lock.at}.`,
      );
      over = held.generation;
    }
    const mine: LockFile = { holder, at: new Date(now()).toISOString() };
    try {
      const generation = await bucket.write(name, JSON.stringify(mine), over);
      return async () => {
        // A lock already taken over by a later run is theirs to remove.
        await bucket.remove(name, generation).catch(() => undefined);
      };
    } catch (error) {
      if (!(error instanceof WroteFirst)) throw error;
      // Another run took it between the read and the write: wait for that one.
    }
  }
}

function parse(text: string): LockFile {
  try {
    const lock = JSON.parse(text) as Partial<LockFile>;
    return { holder: lock.holder ?? "unknown", at: lock.at ?? "" };
  } catch {
    return { holder: "unknown", at: "" };
  }
}
