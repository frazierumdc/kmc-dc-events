import { execFileSync } from "node:child_process";
import { loadDotEnv, syncSettings } from "./config.ts";

export { ROOT } from "./config.ts";

/**
 * The feed token: WIX_FEED_TOKEN when set (the update job sets it from Secret Manager, D61),
 * then a gitignored .env at the repository root, then the dev project's Secret Manager through
 * the Mac's gcloud sign-in (FEED_PROJECT overrides the project). Never printed (NFR-7).
 * Exits with code 2 when there is none.
 */
export function feedToken(): string {
  if (!syncSettings().feedToken) loadDotEnv();
  const token = syncSettings().feedToken || fromSecretManager();
  if (!token) {
    console.error(
      `No feed token: sign gcloud in with access to ${syncSettings().feedProject}'s Secret Manager, or set WIX_FEED_TOKEN.`,
    );
    process.exit(2);
  }
  return token;
}

/** The latest WIX_FEED_TOKEN in Secret Manager, or "" when gcloud can't read it. */
function fromSecretManager(): string {
  const project = syncSettings().feedProject;
  try {
    return execFileSync(
      "gcloud",
      [
        "secrets",
        "versions",
        "access",
        "latest",
        "--secret",
        "WIX_FEED_TOKEN",
        "--project",
        project,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}
