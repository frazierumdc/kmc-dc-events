// The mail memory in the environment's bucket (D63, docs/architecture/storage.md): pulled
// into the memory's folder before a run and pushed back after it. The push names the version
// it read, so it fails when another run wrote first, never overwriting what that run sent.
// The bucket itself is packages/cloud's.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Bucket, Stored } from "@kmcdc/cloud";
import { SEND_EMAIL } from "@kmcdc/domain";

/** The memory's two files: the bucket's name for each, and its name in the memory's folder. */
const FILES = [
  { stored: SEND_EMAIL.state, local: "state.json" },
  { stored: SEND_EMAIL.websiteAtLastChangesEmail, local: "website.json" },
] as const;

/** What was pulled, to push against: each file's version and text, "0" where there was none. */
export type Pulled = Record<string, Stored>;

/** Puts the bucket's memory in `dir`, over what is there; a file the bucket lacks is left. */
export async function pullMemory(bucket: Bucket, dir: string): Promise<Pulled> {
  const pulled: Pulled = {};
  await mkdir(dir, { recursive: true });
  for (const file of FILES) {
    const stored = await bucket.read(file.stored);
    pulled[file.stored] = stored ?? { text: "", generation: "0" };
    if (stored) await writeFile(path.join(dir, file.local), stored.text);
  }
  return pulled;
}

/** Writes back each file of `dir` that changed since the pull; returns the names written. */
export async function pushMemory(bucket: Bucket, dir: string, pulled: Pulled): Promise<string[]> {
  const written: string[] = [];
  for (const file of FILES) {
    const text = await readFile(path.join(dir, file.local), "utf8").catch(() => null);
    const before = pulled[file.stored] ?? { text: "", generation: "0" };
    if (text === null || text === before.text) continue;
    await bucket.write(file.stored, text, before.generation);
    written.push(file.stored);
  }
  return written;
}
