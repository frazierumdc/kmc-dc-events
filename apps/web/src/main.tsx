import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { detectPlatform, followsAppleTextSize } from "@kmcdc/ui";
import "@kmcdc/ui/styles.css";
import "./splash.css";
import { App } from "./App.tsx";
import { applyWaitingVersion, browserEnv, startAppUpdate } from "./app-shell/app-update.ts";
import { startSplash } from "./app-shell/splash.ts";

document.documentElement.dataset.platform = detectPlatform(navigator.userAgent);
// The build, shown to readers in Settings (EV-41); here for the service worker's tests.
document.documentElement.dataset.build = __BUILD_ID__;
// iPhone text follows the phone's text size (NFR-2); Android Chrome does it through the
// text-scale meta tag in index.html.
if (followsAppleTextSize(navigator.platform, navigator.maxTouchPoints))
  document.documentElement.dataset.text = "apple";

// The splash in index.html stays 3 seconds, and until the schedule shows (EV-42).
const splash = startSplash();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// The service worker runs only in real builds; a kill-switch build registers none.
const env = import.meta.env.PROD && __SERVICE_WORKER__ ? browserEnv() : null;

// A new version that was waiting is applied before anything shows, with nothing said (EV-21).
if (!env || !(await applyWaitingVersion(env))) {
  if (env) startAppUpdate(env);
  createRoot(root).render(
    <StrictMode>
      <App onReady={splash.ready} splash={splash} />
    </StrictMode>,
  );
}
