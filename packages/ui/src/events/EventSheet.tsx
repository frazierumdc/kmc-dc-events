import { useEffect, useRef, useState } from "react";
import { ChoiceSheet, type Choice } from "../shared/ChoiceSheet.tsx";
import { descriptionParts } from "./description-links.ts";
import { Toggle } from "../notifications/NotificationsScreen.tsx";
import {
  BellIcon,
  CalendarGoneIcon,
  CalendarIcon,
  CloseIcon,
  PinIcon,
  ScreenIcon,
  UpdatedIcon,
} from "../shared/icons.tsx";

export interface SheetLink {
  label: string;
  href: string;
  /** A short line under the button. */
  caption?: string | null;
}

/**
 * Add to calendar or Directions: one place opens at once; more open an action sheet to
 * choose from.
 */
export interface ChoiceAction {
  label: string;
  choices: readonly Choice[];
}

export interface SheetActionLinks {
  /** Register, or More info (D36). */
  main: SheetLink;
  /** Join online or Register online (D46); null when there's no online option. */
  online: SheetLink | null;
  calendar: ChoiceAction;
  directions: ChoiceAction | null;
  /** The event's link. */
  share: ShareAction;
}

export interface ShareAction {
  /** The event's own link; its preview shows the event's picture. */
  url: string;
}

export interface EventSheetProps {
  /** Id for the title, which names the dialog (EV-38). */
  titleId: string;
  /** The website's categories as plain text: `Weekly Meditation Classes`. */
  categories: string | null;
  /** Tints the categories' pill with the kind's colour (D45); null for no kind. */
  kind: "class" | "special" | "prayer" | null;
  /** A class's own colour in place of the kind's: a study program's session or a branch class (D45). */
  tone?: "program" | "branch" | "elsewhere" | null;
  title: string;
  /** Two lines: `Monday, October 5, 2026` and `7:00 PM to 8:15 PM Eastern`. */
  when: readonly [string, string];
  /** The place's name (or `Online`) first, then its address. */
  where: { online: boolean; lines: readonly string[] };
  description: string | null;
  actions: SheetActionLinks;
  /**
   * What changed while the panel was open (NT-5): `updated` once its date, time or place
   * changed, shown as one line under the title; `gone` once it left the schedule, when
   * the panel says so and offers only Close.
   */
  change?: "updated" | "gone" | null;
  /** Notify me (NT-13, NT-48); null where notifications can't be on. */
  follow?: FollowSwitch | null;
  onClose: () => void;
}

/** The panel's Notify me row (NT-13, NT-48). */
export interface FollowSwitch {
  on: boolean;
  /** What it sends: "A reminder the day before each class, and if one changes". */
  detail: string;
  busy: boolean;
  onChange: (on: boolean) => void;
}

/**
 * What the details panel says (EV-30 – EV-35), as the F1 mock-ups draw it (D45): the
 * website's categories in a pill tinted with the kind's colour, the title, ✕, When, Where,
 * the buttons and the description. The main button is filled maroon; the online button
 * (D46) is outlined with a screen, a short line under it; Add to calendar and Share are
 * grey; Directions is outlined. The website's text is shown as text (C-6),
 * keeping its line breaks; web and email addresses in it can be tapped (EV-33).
 * The line under the title is a live region that is always there, so a screen reader says
 * what changed when it changes (NT-5).
 */
export function EventSheet({
  titleId,
  categories,
  kind,
  tone = null,
  title,
  when,
  where,
  description,
  actions,
  change = null,
  follow = null,
  onClose,
}: EventSheetProps) {
  return (
    <>
      <div className="ui-sheet-head">
        <span className="ui-grabber" aria-hidden="true" />
        {categories !== null ? (
          <span className="ui-tag" data-kind={kind ?? undefined} data-tone={tone ?? undefined}>
            {categories}
          </span>
        ) : (
          <span />
        )}
        <button type="button" className="ui-sheet-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="ui-sheet-body">
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <div className="ui-change" role="status">
          {change === "updated" && (
            <p className="ui-updated">
              <UpdatedIcon />
              Updated just now
            </p>
          )}
          {change === "gone" && (
            <div className="ui-gone">
              <CalendarGoneIcon />
              <p>
                <b>This event is no longer on the schedule</b>
                <span>It was cancelled or has ended.</span>
              </p>
            </div>
          )}
        </div>
        {change === "gone" ? (
          <button type="button" className="ui-btn ui-btn-main ui-gone-close" onClick={onClose}>
            Close
          </button>
        ) : (
          <Details
            when={when}
            where={where}
            description={description}
            actions={actions}
            follow={follow}
          />
        )}
      </div>
    </>
  );
}

function Details({
  when,
  where,
  description,
  actions,
  follow,
}: Pick<EventSheetProps, "when" | "where" | "description" | "actions" | "follow">) {
  const [place, ...placeLines] = where.lines;
  return (
    <>
      <dl className="ui-facts">
        <div>
          <dt className="ui-sr">When</dt>
          <dd>
            <CalendarIcon />
            <span>
              <b>{when[0]}</b>
              <span>{when[1]}</span>
            </span>
          </dd>
        </div>
        {place !== undefined && (
          <div>
            <dt className="ui-sr">Where</dt>
            <dd>
              {where.online ? <ScreenIcon /> : <PinIcon />}
              <span>
                <b>{place}</b>
                {placeLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </dd>
          </div>
        )}
      </dl>
      {follow && (
        <div className="ui-follow">
          <span className="ui-info-ic" data-tint="accent" aria-hidden="true">
            <BellIcon />
          </span>
          <span className="ui-info-text">
            Notify me
            <small id="ui-follow-detail">{follow.detail}</small>
          </span>
          <Toggle
            on={follow.on}
            label="Notify me"
            describedBy="ui-follow-detail"
            disabled={follow.busy}
            onChange={follow.onChange}
          />
        </div>
      )}
      <Actions {...actions} />
      {description !== null && <Description text={description} />}
    </>
  );
}

function Description({ text }: { text: string }) {
  return (
    <p className="ui-desc">
      {descriptionParts(text).map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <a key={i} {...linkProps(part.href)}>
            {part.text}
          </a>
        ),
      )}
    </p>
  );
}

/** Web links open outside the app; calendar files and email go to the phone's own app. */
function linkProps(href: string) {
  return /^https?:/.test(href) ? { href, target: "_blank", rel: "noopener" } : { href };
}

function Actions({ main, online, calendar, directions, share }: SheetActionLinks) {
  return (
    <div className="ui-actions">
      <a className="ui-btn ui-btn-main" {...linkProps(main.href)}>
        {main.label}
      </a>
      {online && (
        <div className="ui-online">
          <a
            className="ui-btn ui-btn-outline"
            aria-describedby={online.caption ? "ui-online-caption" : undefined}
            {...linkProps(online.href)}
          >
            <ScreenIcon />
            {online.label}
          </a>
          {online.caption && (
            <p id="ui-online-caption" className="ui-caption">
              {online.caption}
            </p>
          )}
        </div>
      )}
      <div className="ui-tools">
        <ChoiceButton className="ui-btn" {...calendar} />
        <ShareButton {...share} />
      </div>
      {directions && <ChoiceButton className="ui-btn ui-btn-outline" {...directions} />}
    </div>
  );
}

/**
 * Add to calendar and Directions (EV-35): with one place (Google Calendar or Google Maps on
 * Android) the button goes straight there; with more (Apple or Google on iPhone) it opens
 * an action sheet. Focus comes back to the button when the sheet closes.
 */
function ChoiceButton({ className, label, choices }: ChoiceAction & { className: string }) {
  const [choosing, setChoosing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [only] = choices;
  if (choices.length === 1 && only)
    return (
      <a
        className={className}
        href={only.href}
        {...(only.newView ? { target: "_blank", rel: "noopener" } : {})}
      >
        {label}
      </a>
    );
  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => {
          setChoosing(true);
        }}
      >
        {label}
      </button>
      {choosing && (
        <ChoiceSheet
          title={label}
          choices={choices}
          onClose={() => {
            setChoosing(false);
            button.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

const COPIED_MS = 2000;

/**
 * The phone's share menu with the event's link alone, as the message's text: Messages and
 * chat apps turn it into one link preview, made from the event's own page, whose picture
 * shows the name, date, time and place; tapping it opens the event. Handed over as text,
 * not as a link, so the app's own icon isn't offered as the preview. Where there is no
 * menu, the link is copied.
 */
function ShareButton({ url }: ShareAction) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: url });
      } catch {
        // Closed without sharing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
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
    <button type="button" className="ui-btn" onClick={() => void share()}>
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
