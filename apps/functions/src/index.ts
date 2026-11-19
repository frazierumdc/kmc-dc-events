// The timers (D54, D51): at 4:07 AM and 4:07 PM Eastern one starts the stage's update job
// (Cloud Run, D63); at 4:30 AM on Mondays, Wednesdays and Fridays the other starts the email
// job for KMC DC Events (AN-14).
// The Wix signal (D28, slice 1.9): Wix calls wixSignal on every change to an event; a task a
// few minutes later (checkWebsite) reads the website, compares it with the schedule published
// on the stage's site and starts the update job only when the schedule changed (D64).
// Notifications (D65, slice 1.12): the app asks notifyLists to join and leave its lists.
// Reminders (D69, slice 1.16): every 15 minutes sendEventReminders sends the reminders that
// came due, a day before each event and a week before one that isn't weekly.
// One file per function in functions/; what they share is in options.ts.

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { checkWebsite } from "./functions/check-website.ts";
export { notifyLists } from "./functions/notify-lists.ts";
export { sendEventReminders } from "./functions/send-event-reminders.ts";
export { startCheck } from "./functions/start-check.ts";
export { startEventsEmail } from "./functions/start-events-email.ts";
export { startUpdateSchedule } from "./functions/start-update-schedule.ts";
export { wixSignal } from "./functions/wix-signal.ts";
