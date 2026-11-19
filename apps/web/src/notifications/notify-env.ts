// The browser's side of notifications (D65): its permission, the choices kept in local
// storage, Firebase's messaging library downloaded on demand, and the notifyLists function.

import type { PushConfig } from "../../push-config.ts";
import type { InstallGuide } from "@kmcdc/ui";
import type { Messenger, NotifyEnv, NotifySaved } from "./notifications.ts";

const KEY = "kmcdc.notifications";

/** notifyLists, in the same region as the stage's other functions (us-east4). */
export function listsUrl(projectId: string): string {
  return `https://us-east4-${projectId}.cloudfunctions.net/notifyLists`;
}

function readSaved(): NotifySaved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const saved = JSON.parse(raw) as Partial<NotifySaved>;
    return {
      on: saved.on === true,
      token: typeof saved.token === "string" ? saved.token : null,
      lists: Array.isArray(saved.lists) ? saved.lists : [],
      follows: Array.isArray(saved.follows) ? saved.follows : [],
    };
  } catch {
    return null;
  }
}

function writeSaved(saved: NotifySaved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private browsing can refuse storage; the choice lasts until the app is closed.
  }
}

/** Firebase's messaging library, downloaded and started only now (owner, D65). */
async function loadMessenger(config: PushConfig): Promise<Messenger> {
  const [{ initializeApp, getApps }, messaging] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const { vapidKey, ...web } = config;
  const app = getApps()[0] ?? initializeApp(web);
  const service = messaging.getMessaging(app);
  // The app's own service worker shows the notifications (slice 1.12 step 3c).
  const registration = await navigator.serviceWorker.ready;
  // getToken and deleteToken are deprecated for Firebase's newer installation ids (register,
  // onRegistered), but lists (topics) still take only these codes: firebase-admin 14's
  // subscribeToTopic accepts registration tokens, not installation ids (D65).
  return {
    getToken: () =>
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- lists need a token (D65)
      messaging.getToken(service, { vapidKey, serviceWorkerRegistration: registration }),
    deleteToken: async () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the token's own counterpart
      await messaging.deleteToken(service);
    },
  };
}

/** The browser's NotifyEnv; `guide` says whether this is Safari on an iPhone. */
export function browserNotifyEnv(
  config: PushConfig | null,
  guide: InstallGuide,
  standalone: boolean,
): NotifyEnv {
  const iphone =
    guide === "ios27" || guide === "ios26" || guide === "share-bar" || guide === "ios-other";
  const supported =
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined";
  return {
    configured: config !== null,
    permission: () => (supported ? Notification.permission : null),
    requestPermission: () => Notification.requestPermission(),
    // In the Home Screen app iPhone has web push; in Safari or another browser, none (NT-19).
    iphoneSafari: iphone && !standalone,
    read: readSaved,
    write: writeSaved,
    messenger: () => {
      if (config === null) return Promise.reject(new Error("No notifications on this stage"));
      return loadMessenger(config);
    },
    changeLists: async (body) => {
      if (config === null) throw new Error("No notifications on this stage");
      const response = await fetch(listsUrl(config.projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return response.status;
    },
  };
}
