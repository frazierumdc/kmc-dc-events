// The Notifications screen's lists (D65, slice 1.12).

import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { parseListsRequest } from "@kmcdc/domain";
import { changeLists, listsStatus } from "../notify-lists.ts";
import { config, REGION, serviceAccount } from "../options.ts";

/**
 * The Notifications screen (D65, NT-20): a phone sends its code from the messaging service
 * and the lists to join and leave; only the app's own list names are taken. Nothing is kept
 * here. 410 says the code is no good, and the app gets a new one.
 */
export const notifyLists = onRequest(
  {
    region: REGION,
    // Its own account, which may only manage the messaging service's lists
    // (scripts/setup-notifications.sh).
    serviceAccount: serviceAccount("notify-lists"),
    invoker: "public",
    // The stage's own sites: the Hosting addresses and the app's own address (D27).
    cors: config.appOrigins,
    maxInstances: 3,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }
    const request = parseListsRequest(req.body);
    if ("error" in request) {
      res.status(400).json({ error: request.error });
      return;
    }
    const result = await changeLists(request, getMessaging());
    if (result.failed.length > 0)
      logger.warn("Notify lists: some failed", { failed: result.failed });
    res.status(listsStatus(result)).json(result);
  },
);
