// What identifies one deployment of the pipeline, in one place: the website's feed addresses
// and the project a developer's machine reads the feed token from. Placeholders in this copy
// (docs/configuration.md); the environment can override each one (config.ts). Constants only,
// so the feed client stays free of Node's file and process modules.

/** The feed the schedule is copied from. `WIX_FEED_URL` overrides it. */
export const FEED_URL = "https://www.example.org/_functions/appEvents";
/** Every published event whatever its status: the Schedule changes email's record (AN-1). */
export const ALL_EVENTS_URL = "https://www.example.org/_functions/allEvents";
/** The Google project whose Secret Manager holds the Mac's feed token (D61). */
export const FEED_PROJECT = "your-project-id-dev";
