// The publish command's settings (publish-schedule.ts), read from the environment in this
// one module. docs/configuration.md lists each variable.

export interface PublishSettings {
  /** Where relative paths on the command line start: where `pnpm` was run, or the process's own directory. */
  cwd: string;
  /** GOOGLE_OAUTH_ACCESS_TOKEN: the publishing account's token, where a workflow or the developer supplies one. */
  accessToken: string | undefined;
  /** GOOGLE_CLOUD_QUOTA_PROJECT: the project Hosting's API counts the calls against. */
  quotaProject: string | undefined;
}

/** The settings in `env`. Pure. */
export function readPublishSettings(
  env: Record<string, string | undefined>,
  processCwd: string,
): PublishSettings {
  return {
    cwd: env.INIT_CWD ?? processCwd,
    accessToken: env.GOOGLE_OAUTH_ACCESS_TOKEN || undefined,
    quotaProject: env.GOOGLE_CLOUD_QUOTA_PROJECT,
  };
}

/** The settings of this process. */
export function publishSettings(): PublishSettings {
  return readPublishSettings(process.env, process.cwd());
}
