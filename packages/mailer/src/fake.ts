// The fake sender: writes each message to .outbox/ as an .eml file instead of sending it.
// Used locally, in tests, and whenever MAIL_ENV=fake.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMime, type Message } from "./mime.ts";

/** Writes the message and returns the file's path. */
export async function writeToOutbox(message: Message, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = message.subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const file = path.join(dir, `${stamp}-${slug}.eml`);
  await writeFile(file, buildMime(message));
  return file;
}
