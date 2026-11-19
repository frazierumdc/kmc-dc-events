// The Wix signal (D28, slice 1.9).

import { onRequest } from "firebase-functions/v2/https";
import { sameSecret } from "../check-website.ts";
import { REGION, signalSecret, wixSignalAccount } from "../options.ts";
import { queueCheck } from "../queue-check.ts";

/**
 * Wix calls this on every change to an event (wix/backend/events.js), with the stage's secret
 * and no event details. It answers at once and leaves one check per 5-second window.
 */
export const wixSignal = onRequest(
  {
    region: REGION,
    secrets: [signalSecret],
    serviceAccount: wixSignalAccount,
    invoker: "public",
    maxInstances: 2,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }
    if (!sameSecret(req.get("x-kmc-signal"), signalSecret.value())) {
      res.status(403).end();
      return;
    }
    await queueCheck("Wix signal");
    res.status(202).end();
  },
);
