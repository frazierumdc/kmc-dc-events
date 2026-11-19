import { type ReactNode } from "react";
import { type SafariGuide } from "./guide.ts";
import { BarPicture } from "./SafariPictures.tsx";
import { CheckIcon, MoreIcon, PageMenuIcon, ShareIcon } from "../shared/icons.tsx";

export function ChooseSafariBar({
  guide,
  onChoose,
}: {
  guide: SafariGuide;
  onChoose: (guide: SafariGuide) => void;
}) {
  const options: { value: SafariGuide; picture: ReactNode; label: ReactNode }[] = [
    {
      value: "ios27",
      picture: <BarPicture guide="ios27" ring={false} />,
      label: (
        <>
          <PageMenuIcon /> in the address bar
        </>
      ),
    },
    {
      value: "ios26",
      picture: <BarPicture guide="ios26" ring={false} />,
      label: (
        <>
          <MoreIcon /> at the right
        </>
      ),
    },
    {
      value: "share-bar",
      picture: null,
      label: (
        <>
          <ShareIcon /> A Share button in the bar
        </>
      ),
    },
  ];
  const names: Record<SafariGuide, string> = {
    ios27: "Round buttons, with the Page Menu in the address bar",
    ios26: "Round buttons, with More at the right",
    "share-bar": "A Share button in the bar",
  };
  return (
    <>
      <p className="ui-info-note ui-info-lead">
        Look at the bottom of Safari, then pick the one that matches.
      </p>
      <div className="ui-info-card" role="radiogroup" aria-label="Safari’s bar">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === guide}
            aria-label={names[o.value]}
            className="ui-info-option"
            onClick={() => {
              onChoose(o.value);
            }}
          >
            <span>
              {o.picture}
              <span className="ui-info-option-label" data-only={o.picture === null || undefined}>
                {o.label}
              </span>
            </span>
            <span className="ui-radio" aria-hidden="true">
              {o.value === guide && <CheckIcon />}
            </span>
          </button>
        ))}
      </div>
      <p className="ui-info-note">Your choice is remembered on this phone.</p>
    </>
  );
}
