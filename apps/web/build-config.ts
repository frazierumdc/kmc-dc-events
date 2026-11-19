// The app build's settings (vite.config.ts), read from the environment in this one module,
// and each stage's public address. docs/configuration.md lists each variable.

import type { AppEnv } from "./brand-assets.ts";
import { pushConfig, type PushConfig } from "./push-config.ts";

/**
 * Each site's own address (docs/architecture/infrastructure.md), for /get-app's QR code.
 * Placeholder hosts in this copy (docs/configuration.md).
 */
export const SITES: Record<AppEnv, string> = {
  dev: "https://events.dev.example.org",
  test: "https://events.test.example.org",
  prod: "https://events.example.org",
};

export interface BuildConfig {
  /** BUILD_ID: the deploy sets it; local builds show "local". */
  buildId: string;
  /** KILL_SWITCH=1 builds the app with the kill-switch service worker instead of the real one. */
  killSwitch: boolean;
  /** APP_ENV: "dev" or "test"; anything else is the real app. */
  appEnv: AppEnv;
  /** The address of this stage's site. */
  site: string;
  /** LIVE_URL: the live record open apps listen to; "" where the stage has none. */
  liveUrl: string;
  /** WEB_APP_CONFIG and PUSH_PUBLIC_KEY together; null builds an app without notifications (D65). */
  push: PushConfig | null;
}

/** The build's settings in `env`. Pure; throws when the notification settings are malformed. */
export function readBuildConfig(env: Record<string, string | undefined>): BuildConfig {
  const appEnv: AppEnv = env.APP_ENV === "dev" || env.APP_ENV === "test" ? env.APP_ENV : "prod";
  return {
    buildId: env.BUILD_ID ?? "local",
    killSwitch: env.KILL_SWITCH === "1",
    appEnv,
    site: SITES[appEnv],
    liveUrl: env.LIVE_URL ?? "",
    push: pushConfig(env.WEB_APP_CONFIG, env.PUSH_PUBLIC_KEY),
  };
}

/** The settings of this build. */
export function buildConfig(): BuildConfig {
  return readBuildConfig(process.env);
}
