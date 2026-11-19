// The messaging service's settings for the stage (D65, slice 1.12): the Firebase web app's
// settings and the public half of the stage's own web push key, which the deploy reads from
// the project at build time (publish-site.yml, scripts/setup-notifications.sh). Neither is a
// secret: every phone that turns notifications on reads them. Without both, the app is built
// without notifications.

export interface PushConfig {
  apiKey: string;
  appId: string;
  messagingSenderId: string;
  projectId: string;
  /** The public half of the stage's web push key ("VAPID"), from Secret Manager. */
  vapidKey: string;
}

const TEXT = /^[A-Za-z0-9_:.-]{1,200}$/;

/** WEB_APP_CONFIG and PUSH_PUBLIC_KEY as one PushConfig; null when either is unset; throws when malformed. */
export function pushConfig(config = "", key = ""): PushConfig | null {
  if (config.trim() === "" || key.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    throw new Error("WEB_APP_CONFIG isn't JSON");
  }
  const fields = parsed as Record<string, unknown>;
  const out = { ...fields, vapidKey: key.trim() } as Record<string, unknown>;
  for (const name of ["apiKey", "appId", "messagingSenderId", "projectId", "vapidKey"] as const)
    if (typeof out[name] !== "string" || !TEXT.test(out[name]))
      throw new Error(`WEB_APP_CONFIG or PUSH_PUBLIC_KEY has no good ${name}`);
  return {
    apiKey: out.apiKey as string,
    appId: out.appId as string,
    messagingSenderId: out.messagingSenderId as string,
    projectId: out.projectId as string,
    vapidKey: out.vapidKey as string,
  };
}
