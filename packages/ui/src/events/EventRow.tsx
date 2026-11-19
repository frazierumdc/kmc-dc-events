import { useState, type MouseEvent } from "react";
import { PinIcon, ScreenIcon } from "../shared/icons.tsx";

export interface EventRowProps {
  /** `7:00 PM` or `All day`. */
  time: string;
  title: string;
  /** Gives the row its colour bar (D45); null for an event with no kind. */
  kind: "class" | "special" | "prayer" | null;
  /** A class's own colour in place of the kind's: a study program's session or a branch class (D45). */
  tone?: "program" | "branch" | "elsewhere" | null;
  /** Where to go in person: `KMC DC`, `Richmond`; null for none or online only. */
  place: string | null;
  /** Online, or can be attended online (D46). */
  online: boolean;
  detail: string | null;
  /** What screen readers hear for the whole row. */
  label: string;
  /** The event's picture on the app's own site (D7); null for none. */
  picture?: string | null;
  /** The center's logo: shown on the kind's colour when the event has no picture, or its picture can't load. */
  defaultPicture?: string | null;
  /** The event's own address, `/e/{id}` (EV-37). */
  href: string;
  /** Opens the details panel in place of following the link. */
  onOpen: (row: HTMLAnchorElement) => void;
}

/**
 * One event (EV-11), as option J of the picture-card mock-ups (owner, 13 November 2026): the
 * event's picture with its start time on it, a bar in the kind's colour (D45), the title on
 * up to two lines, the "where" line, and the second line. Every row keeps the same lines, so
 * every row is the same height; at very large text the row grows and nothing is cut. Where:
 * a filled pin and the place in the title's colour, semi-bold; a screen and Online in quiet
 * grey, told apart by icon, word and weight, never by a colour of their own, which keeps
 * meaning the kind. The picture is decoration: the kind's colour shows while it loads; when
 * there is none, or it can't load offline, the center's logo shows on that colour. Screen readers hear `label` in place of the
 * parts. The row is a link to the event's address; a plain tap opens the details panel
 * (EV-36).
 */
export function EventRow({
  time,
  title,
  kind,
  tone = null,
  place,
  online,
  detail,
  label,
  picture = null,
  defaultPicture = null,
  href,
  onOpen,
}: EventRowProps) {
  // The picture that couldn't load, so a new picture gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const shown = picture !== null && picture !== failed;
  const clock = /^(\d{1,2}:\d{2}) ([AP]M)$/.exec(time);
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window (⌘, Ctrl, Shift, middle button) follows the link as usual.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(e.currentTarget);
  };
  return (
    <li>
      <a
        className="ui-row"
        href={href}
        data-kind={kind ?? undefined}
        data-tone={tone ?? undefined}
        onClick={open}
      >
        <span className="ui-sr">{label}</span>
        <span className="ui-pic" aria-hidden="true">
          {shown ? (
            <img
              src={picture}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => {
                setFailed(picture);
              }}
            />
          ) : (
            defaultPicture !== null && (
              <img className="ui-pic-default" src={defaultPicture} alt="" decoding="async" />
            )
          )}
          <span className={clock ? "ui-time" : "ui-time ui-allday"}>
            {clock ? (
              <>
                <b>{clock[1]}</b>
                <i>{clock[2]}</i>
              </>
            ) : (
              <b>{time}</b>
            )}
          </span>
        </span>
        <span className="ui-kindbar" aria-hidden="true" />
        <span className="ui-rowmain" aria-hidden="true">
          <span className="ui-title">{title}</span>
          {/* The where line and the second line are always there, empty or not: every row the same height. */}
          <span className="ui-where">
            {place !== null && (
              <span className="ui-place">
                <PinIcon filled />
                {place}
              </span>
            )}
            {online && (
              <span>
                <ScreenIcon />
                Online
              </span>
            )}
          </span>
          <span className="ui-sub">{detail}</span>
        </span>
      </a>
    </li>
  );
}
