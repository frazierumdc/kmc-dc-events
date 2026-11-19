// The repository's address on GitHub, for links in the emails (D57): never written in the
// code, so moving the repository to another owner needs no change here.

import { execFileSync } from "node:child_process";

/** `https://github.com/<owner>/<name>` from a git remote URL (https or ssh); null otherwise. */
export function repositoryFromRemote(remote: string): string | null {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match ? `https://github.com/${match[1] ?? ""}/${match[2] ?? ""}` : null;
}

/**
 * GitHub Actions' own GITHUB_SERVER_URL and GITHUB_REPOSITORY; on a Mac, the `origin` remote.
 * Throws when neither says where the repository is.
 */
export function repositoryUrl(env: NodeJS.ProcessEnv, cwd: string): string {
  if (env.GITHUB_REPOSITORY)
    return `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY}`;
  let remote = "";
  try {
    remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8" });
  } catch {
    // Not a git checkout: said below.
  }
  const url = repositoryFromRemote(remote);
  if (!url)
    throw new Error("Set GITHUB_REPOSITORY (owner/name): there is no GitHub origin remote.");
  return url;
}
