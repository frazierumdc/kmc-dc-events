// What one copy hands to Send email (D63): its result and the files the emails are made from
// (packages/sync/src/mail-inputs.ts), in one file in the bucket, so each job reads one name
// and nothing has to be listed.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const HandOver = z.object({
  /** The copy's result. */
  result: z.enum(["same", "changed", "failed"]),
  /** The new schedule is on the site. */
  published: z.boolean(),
  /** "wix" when the server's check started the copy; "" for the timer or a person. */
  trigger: z.string(),
  /** The copy's `mail/` files, by name. */
  files: z.record(z.string(), z.string()),
});
export type HandOver = z.infer<typeof HandOver>;

/** The `mail/` folder's files, by name. */
export async function readMailFiles(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const name of await readdir(dir).catch(() => []))
    files[name] = await readFile(path.join(dir, name), "utf8");
  return files;
}

/** Writes the files into `dir`; only plain names, never a path. */
export async function writeMailFiles(dir: string, files: Record<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    if (name !== path.basename(name)) throw new Error(`Not a file name: ${name}`);
    await writeFile(path.join(dir, name), text);
  }
}
