import { type ReactNode } from "react";
import { type SafariGuide } from "./guide.ts";
import { InstallPlayer } from "./InstallPlayer.tsx";
import {
  BarPicture,
  MenuPicture,
  SharePicture,
  ListPicture,
  AddPicture,
} from "./SafariPictures.tsx";
import { Key, Step } from "./Step.tsx";
import {
  AddHomeIcon,
  ChevronDownIcon,
  MoreIcon,
  PageMenuIcon,
  ShareIcon,
} from "../shared/icons.tsx";

/**
 * Safari's steps (IN-3, IN-5), each with a picture of the part of Safari the reader sees
 * then, the button to tap ringed. The pictures follow real iOS 27 screenshots: the Page
 * Menu (≡) with Share first; the Share sheet's round buttons, the fourth View More (⌄),
 * which opens the list with Add to Home Screen; then the Add to Home Screen screen.
 */
interface SafariStep {
  key: string;
  /** What to tap; `where` says where it is, left out where the steps are short. */
  lead: ReactNode;
  where?: string;
  hint?: string;
  picture?: ReactNode;
}

function safariSteps(guide: SafariGuide, icon: string): SafariStep[] {
  const share = (
    <>
      <ShareIcon />
      Share
    </>
  );
  const viewMore = (
    <>
      <ChevronDownIcon />
      View More
    </>
  );
  const addHome = (
    <>
      <AddHomeIcon />
      Add to Home Screen
    </>
  );
  const steps: SafariStep[] = [];
  if (guide === "ios27")
    steps.push({
      key: "open",
      lead: (
        <>
          Tap{" "}
          <Key label="Page Menu">
            <PageMenuIcon />
          </Key>
        </>
      ),
      where: " in the address bar",
      picture: <BarPicture guide="ios27" />,
    });
  if (guide === "ios26")
    steps.push({
      key: "open",
      lead: (
        <>
          Tap{" "}
          <Key label="More">
            <MoreIcon />
          </Key>
        </>
      ),
      where: " at the bottom right",
      picture: <BarPicture guide="ios26" />,
    });
  steps.push(
    guide === "share-bar"
      ? {
          key: "share",
          lead: (
            <>
              Tap <Key>{share}</Key>
            </>
          ),
          where: " in Safari’s bar",
        }
      : {
          key: "share",
          lead: (
            <>
              Tap <Key>{share}</Key>
            </>
          ),
          where: " at the top of the menu",
          picture: <MenuPicture guide={guide} />,
        },
    {
      key: "more",
      lead: (
        <>
          Tap <Key>{viewMore}</Key>
        </>
      ),
      hint: "The fourth round button, under the apps. Already see a long list? Go on to the next step.",
      picture: <SharePicture icon={icon} />,
    },
    {
      key: "add",
      lead: (
        <>
          Tap <Key>{addHome}</Key>
        </>
      ),
      hint: "In the list that opens. Scroll down if you don’t see it.",
      picture: <ListPicture />,
    },
    {
      key: "done",
      lead: (
        <>
          Leave <WebAppKey /> on, then tap <Key>Add</Key>
        </>
      ),
      where: " at the top right",
      picture: <AddPicture icon={icon} />,
    },
  );
  return steps;
}

export function SafariSteps({
  guide,
  icon,
  play,
}: {
  guide: SafariGuide;
  icon: string;
  play: boolean;
}) {
  const steps = safariSteps(guide, icon);
  // The player needs Safari's five screens, each with its picture (iOS 27 and 26).
  if (play && steps.length === 5 && steps.every((step) => step.picture != null))
    return (
      <InstallPlayer
        steps={steps.map((step) => ({
          key: step.key,
          text: <>{step.lead}.</>,
          picture: step.picture,
        }))}
        icon={icon}
        appName="KMC DC Events"
        menuFrom={guide === "ios26" ? "right" : "left"}
      />
    );
  return (
    <ol className="ui-steps" role="list">
      {steps.map((step, i) => (
        <Step key={step.key} n={i + 1} hint={step.hint} picture={step.picture}>
          {step.lead}
          {step.where}.
        </Step>
      ))}
    </ol>
  );
}

function WebAppKey() {
  return (
    <Key>
      Open as Web App
      <span className="ui-switch" aria-hidden="true" />
    </Key>
  );
}
