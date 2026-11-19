// Sends one test notification to one list, by hand, from the Mac (slice 1.12 step 3c): the
// phones on that list show it with the app closed, and tapping it opens the app.
//
//   GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
//     node packages/cloud/src/notify-test.ts your-project-id-dev type-class
//
// The signed-in account needs to be allowed to send (Owner is). Nothing else changes.

import { fcmSend, isNotifyList } from "@kmcdc/domain";
import { sendMessage } from "./messages.ts";
import { accessToken } from "./token.ts";

const [project, list] = process.argv.slice(2);
if (!project || !isNotifyList(list)) {
  console.error("Usage: node packages/cloud/src/notify-test.ts <project> <list, e.g. type-class>");
  process.exit(2);
}

const now = new Date();
const name = await sendMessage({
  project,
  body: fcmSend(
    list,
    {
      title: "Test from KMC DC Events",
      body: `If you see this, notifications reach this phone (${list}).`,
      url: "/",
      tag: "test",
    },
    new Date(now.getTime() + 60 * 60 * 1000),
    now,
  ),
  token: () => accessToken(),
});
console.log(`Sent to ${list}: ${name}`);
