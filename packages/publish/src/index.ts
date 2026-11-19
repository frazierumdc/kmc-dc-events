// What is published for each event, beside the schedule: its address, calendar file, share
// text, share picture and its own page. This entry is pure and safe in a browser: the app's
// details panel uses the same address and calendar code as the publisher. The modules that
// need Node (share-pictures.ts draws, schedule-files.ts gathers every file) and the commands
// at the package root are imported or run by path, never through this entry.
export * from "./calendar.ts";
export * from "./event-pages.ts";
export * from "./event-where.ts";
export * from "./online-link.ts";
export * from "./share-picture.ts";
export * from "./share.ts";
