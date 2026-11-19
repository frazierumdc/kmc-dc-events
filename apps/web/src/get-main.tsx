// The page for people new to the app, /get-app (IN-10): Open the app first, then the steps to add
// it to the Home Screen for this phone, the same as Settings' (InstallSteps). On a computer the
// QR code leads.

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChooseSafariBar,
  detectPlatform,
  followsAppleTextSize,
  InstallSteps,
  SettingsIcon,
  type InstallGuide,
  type SafariGuide,
} from "@kmcdc/ui";
import "@kmcdc/ui/get-app.css";
import "./get.css";
import { installGuide } from "./install/install-guide.ts";
import { readSafariGuide, saveSafariGuide } from "./install/install-guide-store.ts";

document.documentElement.dataset.platform = detectPlatform(navigator.userAgent);
if (followsAppleTextSize(navigator.platform, navigator.maxTouchPoints))
  document.documentElement.dataset.text = "apple";

const ICON = "/apple-touch-icon-180x180.png";
const found = installGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
const isSafari = (g: InstallGuide): g is SafariGuide =>
  g === "ios27" || g === "ios26" || g === "share-bar";

// Opened from the app (Settings' Add to Home Screen), a bar leads back to it: the Home Screen
// app has no browser Back.
if (cameFromApp(document.referrer)) {
  const back = document.getElementById("get-back");
  if (back) back.hidden = false;
}

// Back to the app returns with no splash (EV-42); Open the app opens it with its welcome.
document.querySelector("#get-back a")?.addEventListener("click", () => {
  try {
    sessionStorage.setItem("kmcdc.fromGet", "1");
  } catch {
    // The splash shows; nothing else changes.
  }
});

function cameFromApp(referrer: string): boolean {
  try {
    const from = new URL(referrer);
    return from.origin === location.origin && !/^\/get-app(\/|$)/.test(from.pathname);
  } catch {
    return false;
  }
}

// Android says "home screen", as Settings does there (IN-7).
if (found === "android" || found === "android-other") {
  const best = document.getElementById("get-best");
  if (best) best.textContent = "The app works best from your home screen.";
}

if (found === "computer") {
  const qr = document.getElementById("get-qr");
  if (qr) qr.hidden = false;
} else {
  const root = document.getElementById("get-root");
  if (root)
    createRoot(root).render(
      <StrictMode>
        <GetSteps />
      </StrictMode>,
    );
}

function GetSteps() {
  const [picked, setPicked] = useState(readSafariGuide);
  const [choosing, setChoosing] = useState(false);
  const guide = isSafari(found) && picked ? picked : found;
  // Android says "home screen", as Settings does there (IN-7).
  const home = guide === "android" || guide === "android-other" ? "home screen" : "Home Screen";

  if (choosing && isSafari(guide))
    return (
      <section className="get-steps" aria-labelledby="get-choose-h">
        <button
          type="button"
          className="get-back"
          onClick={() => {
            setChoosing(false);
          }}
        >
          ‹ Back to the steps
        </button>
        <h2 id="get-choose-h" className="get-steps-h">
          Which looks like yours?
        </h2>
        <ChooseSafariBar
          guide={guide}
          onChoose={(g) => {
            saveSafariGuide(g);
            setPicked(g);
            setChoosing(false);
          }}
        />
      </section>
    );

  const again = (
    <p className="get-steps-sub">
      Tap{" "}
      <span className="get-i" role="img" aria-label="Settings">
        <SettingsIcon />
      </span>{" "}
      in the app to see these steps again.
    </p>
  );
  const steps = (play: boolean) => (
    <InstallSteps
      guide={guide}
      icon={ICON}
      link={`${location.origin}/get-app`}
      onChange={() => {
        setChoosing(true);
      }}
      play={play}
    />
  );

  // Safari's steps with the menu (iOS 27 and 26) fit one screen and play by themselves.
  if (guide === "ios27" || guide === "ios26")
    return (
      <section className="get-steps get-plays" aria-labelledby="get-steps-h">
        <h2 id="get-steps-h" className="get-steps-h">
          Add it to your {home}
        </h2>
        {steps(true)}
        {again}
      </section>
    );

  return (
    <section className="get-steps" aria-labelledby="get-steps-h">
      <h2 id="get-steps-h" className="get-steps-h">
        Add it to your {home}
      </h2>
      {again}
      <div className="ui-info-card">{steps(false)}</div>
      <p className="get-note">Then it opens full screen from its own icon.</p>
    </section>
  );
}
