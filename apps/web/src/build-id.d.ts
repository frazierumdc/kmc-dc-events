// Replaced at build time by vite.config.ts.
declare const __BUILD_ID__: string;
/** False in a kill-switch build, which must not register a service worker. */
declare const __SERVICE_WORKER__: boolean;
/** The live record's address (NT-1); empty where the stage has none. */
declare const __LIVE_URL__: string;
/** The messaging service's settings (D65); null where the stage has no notifications. */
declare const __PUSH_CONFIG__: import("../push-config.ts").PushConfig | null;
