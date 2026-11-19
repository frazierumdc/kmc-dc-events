import { useEffect, useRef, useState } from "react";
import { COPIED_MS } from "../shared/copied.ts";
import { isSafari, SAFARI_LABEL, type InstallGuide } from "./guide.ts";
import { SafariSteps } from "./SafariSteps.tsx";
import { Key, Step } from "./Step.tsx";
import { CheckIcon, LinkIcon, MenuDotsIcon } from "../shared/icons.tsx";

/**
 * The steps to add the app for this browser (IN-2 – IN-7), shared by Settings and the page for
 * people new to the app, /get-app (IN-10), so both always show the same steps and pictures;
 * /get-app plays Safari's (`play`).
 * `onChange` opens "Not what you see?" (IN-4).
 */
export function InstallSteps({
  guide,
  icon,
  link,
  onChange,
  play = false,
}: {
  guide: InstallGuide;
  icon: string;
  link: string;
  onChange: () => void;
  /** /get-app: Safari's steps on one screen, playing by themselves (IN-10). */
  play?: boolean;
}) {
  return (
    <>
      {isSafari(guide) && (
        <>
          <div className="ui-info-for">
            <span>
              Steps for <b>{SAFARI_LABEL[guide]}</b>
            </span>
            <button type="button" onClick={onChange}>
              Not what you see?
            </button>
          </div>
          <SafariSteps guide={guide} icon={icon} play={play} />
        </>
      )}
      {guide === "android" && (
        <>
          <div className="ui-info-for">
            <span>
              Steps for <b>Chrome</b>
            </span>
          </div>
          <ol className="ui-steps" role="list">
            <Step n={1}>
              Tap{" "}
              <Key label="More">
                <MenuDotsIcon />
              </Key>{" "}
              on the right of the address bar.
            </Step>
            <Step n={2}>
              Tap <Key>Install and create shortcut</Key>.
            </Step>
            <Step n={3}>
              Tap <Key>Install</Key>.
            </Step>
          </ol>
        </>
      )}
      {guide === "ios-other" && (
        <OpenFirst
          title="Open this page in Safari first"
          text="Only Safari can add the app to an iPhone’s Home Screen. Copy the link, open Safari, and paste it into the address bar."
          link={link}
        />
      )}
      {guide === "android-other" && (
        <OpenFirst
          title="Open this page in Chrome first"
          text="Copy the link, open Chrome, and paste it into the address bar."
          link={link}
        />
      )}
      {guide === "computer" && (
        <p className="ui-info-row">
          <b>Open this page on your phone</b>
          Then tap Settings for the steps for your iPhone or Android phone.
        </p>
      )}
    </>
  );
}

/** Another browser can't add the app: open the page in the phone's own browser (IN-6). */
function OpenFirst({ title, text, link }: { title: string; text: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
  };
  return (
    <>
      <p className="ui-info-row">
        <b>{title}</b>
        {text}
      </p>
      <button type="button" className="ui-info-copy" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <LinkIcon />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </>
  );
}
