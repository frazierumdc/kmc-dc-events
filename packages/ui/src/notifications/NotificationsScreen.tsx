import { useState } from "react";
import { BellIcon, BellOffIcon, ChevronRightIcon, PinIcon, ScreenIcon } from "../shared/icons.tsx";

/** What the screen shows (NT-17 – NT-19); the app works it out (apps/web/src/notifications.ts). */
export type NotificationsState = "off" | "on" | "refused" | "home-screen";

export interface NotificationsProps {
  state: NotificationsState;
  /** True while turning on or off: the phone's question, the library, the lists. */
  busy: boolean;
  /** Set when turning on or off failed. */
  failed: boolean;
  /** iPhone or Android words and steps (EV-22). */
  android: boolean;
  /** /get-app, with the steps to add the app (IN-10). */
  addLink: string;
  /** Every event and series on the schedule, for Classes, Special and Prayers (NT-22); none
   * before it loads. */
  choices: readonly EventChoiceRow[];
  /** The screen opened: the app gets ready, so turning on doesn't wait. */
  onOpen?: () => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
  /** An event's switch on its kind's screen, by its list: the same as its panel's (NT-22). */
  onFollow: (list: string, on: boolean) => void;
}

/** An event's colour: its kind's, as in the list (D45). */
export type ChoiceKind = "class" | "branch" | "program" | "special" | "elsewhere" | "prayer";

/** The list's kinds, as its filter names them (EV-12): a study program or branch class is a class. */
export type KindGroup = "class" | "special" | "prayer";

export const KIND_GROUPS: readonly { kind: KindGroup; name: string }[] = [
  { kind: "class", name: "Classes" },
  { kind: "special", name: "Special Events" },
  { kind: "prayer", name: "Prayers" },
];

/** Which of the list's kinds an event is under. */
export const kindGroup = (kind: ChoiceKind | null | undefined): KindGroup =>
  kind === "elsewhere" ? "special" : kind === "special" || kind === "prayer" ? kind : "class";

/** Under a kind: its own, and Classes too for a special event the website also lists as a class (D45). */
const underKind = (c: Pick<EventChoiceRow, "kind" | "alsoClass">, kind: KindGroup) =>
  kindGroup(c.kind) === kind || (kind === "class" && c.alsoClass === true);

/**
 * Classes, grouped like with like (owner, 13 November 2026): the temple's own, the branches',
 * then the study programs. Special and Prayers are one group each, with no heading.
 */
const CLASS_GROUPS: readonly { name: string; kinds: readonly (ChoiceKind | null | undefined)[] }[] =
  [
    // A special event also listed as a class is among the center's own.
    { name: "At KMC DC", kinds: ["class", "special", null, undefined] },
    { name: "Branch classes", kinds: ["branch"] },
    { name: "Study programs", kinds: ["program"] },
  ];

/** An event or series on its kind's screen (NT-22): its name, when, where, its kind and its switch. */
export interface EventChoiceRow {
  list: string;
  title: string;
  /** "Weekly · Wednesdays, 7:00 PM", "One time · Sunday, November 15, 2026" or "2 times · …". */
  detail: string;
  /** Its kind, for its colour (D45) and the kind it is under. */
  kind?: ChoiceKind | null;
  /** A special event the website also lists as a class: under Classes too, in its special colour (D45). */
  alsoClass?: boolean;
  /** Its picture's thumbnail on the site (slice 1.13); null or absent when it has none. */
  picture?: string | null;
  /** Where, as the list says it: `KMC DC`, `Richmond`; null for none. */
  place?: string | null;
  online?: boolean;
  /** Held more than once: followed whenever it is held. */
  series: boolean;
  /** Which reminders it sends (NT-47): "Day before" or "Week before and day before". */
  reminders?: string;
  on: boolean;
}

/**
 * An event's picture beside its name, as in the approved mock-up; its kind's colour shows
 * while it loads and when there is none, or it can't load offline (slice 1.13).
 */
function Thumb({ event }: { event: EventChoiceRow }) {
  return (
    <span className="ui-notify-ph" data-kind={event.kind ?? undefined} aria-hidden="true">
      {event.picture && (
        <img
          src={event.picture}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.remove();
          }}
        />
      )}
    </span>
  );
}

/** A switch as each phone draws it, named by its row (WCAG 4.1.2). */
export function Toggle({
  on,
  label,
  describedBy,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  /** The id of a line that says more, as Notify me of changes' "Every Wednesday …". */
  describedBy?: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="ui-toggle"
      aria-checked={on}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => {
        onChange(!on);
      }}
    />
  );
}

const LEAD = "Follow events to be reminded before them and told if they change.";

/**
 * Notifications in Settings (NT-17 – NT-19, NT-47), as in the approved mock-ups (option E,
 * owner, 13 November 2026; Your events, option B, 17 November 2026): a switch for this phone,
 * the events followed, each saying which reminders it sends, then a row for each of the
 * list's kinds, Classes, Special and Prayers, with how many of it are followed, each opening
 * its events; refused in
 * the phone's settings, how to allow them there; in Safari on iPhone, add the app first.
 */
export function NotificationsScreen(
  props: NotificationsProps & { onKind: (kind: KindGroup) => void },
) {
  const { state, busy, failed, android, addLink, choices } = props;
  const { onTurnOn, onTurnOff, onKind, onFollow } = props;
  // An event switched off here stays, switched off, until the screen is left, so it can be
  // turned back on (NT-47).
  const [kept, setKept] = useState<readonly string[]>([]);
  const error = failed && (
    <p className="ui-notify-error" role="alert">
      Couldn’t change notifications. Check your connection and try again.
    </p>
  );

  if (state === "home-screen")
    return (
      <>
        <p className="ui-notify-lead">{LEAD}</p>
        <div className="ui-notify-box">
          <span className="ui-info-ic" data-tint="accent" aria-hidden="true">
            <BellIcon />
          </span>
          <span className="ui-info-text">
            <b>Add the app to your Home Screen first</b>
            <small>
              On iPhone, notifications work only in the app opened from its Home Screen icon.
            </small>
          </span>
        </div>
        <a className="ui-btn ui-btn-main ui-notify-main" href={addLink}>
          Add to Home Screen
        </a>
        <p className="ui-info-note">
          Then open the app from its icon and come back here to turn them on.
        </p>
      </>
    );

  if (state === "refused")
    return (
      <>
        <div className="ui-notify-box">
          <span className="ui-info-ic" data-tint="grey" aria-hidden="true">
            <BellOffIcon />
          </span>
          <span className="ui-info-text">
            <b>Notifications are off for this app</b>
            <small>
              They were turned off in the phone’s settings. Turn them on there, then come back.
            </small>
          </span>
        </div>
        <h3 className="ui-info-section">To allow them</h3>
        <div className="ui-info-card">
          <ol className="ui-notify-steps">
            {android ? (
              <>
                <li>
                  Open the phone’s <b>Settings</b>.
                </li>
                <li>
                  Tap <b>Apps</b>, then <b>KMC DC Events</b>.
                </li>
                <li>
                  Tap <b>Notifications</b> and turn them on.
                </li>
              </>
            ) : (
              <>
                <li>
                  Open the iPhone’s <b>Settings</b>.
                </li>
                <li>
                  Tap <b>Notifications</b>, then <b>KMC DC Events</b>.
                </li>
                <li>
                  Turn on <b>Allow Notifications</b>.
                </li>
              </>
            )}
          </ol>
        </div>
        <p className="ui-info-note">The app won’t ask again by itself.</p>
      </>
    );

  // On or off, the same screen (NT-17): off, its switch is off, the events followed are kept
  // and counted, and they wait until notifications are on.
  const on = state === "on";
  const yours = choices.filter((c) => c.on || kept.includes(c.list));
  return (
    <>
      <div className="ui-info-card ui-notify-card">
        <div className="ui-notify-row">
          <span className="ui-info-text">
            Notifications
            <small>On this phone</small>
          </span>
          <Toggle
            on={on}
            label="Notifications"
            disabled={busy}
            onChange={(next) => {
              if (next) onTurnOn();
              else onTurnOff();
            }}
          />
        </div>
      </div>
      <p className="ui-info-note">
        {on
          ? "You’ll be reminded before each event below, and told if it changes."
          : `${LEAD} Your phone will ask you to allow notifications.`}
      </p>
      {error}
      <h3 className="ui-info-section ui-notify-section">Your events</h3>
      {yours.length > 0 ? (
        // Off, the events followed are kept and shown, and wait (NT-17).
        <div className={on ? undefined : "ui-follow-off"}>
          <FollowList
            rows={yours}
            busy={busy || !on}
            reminders
            onFollow={(list, next) => {
              if (!next) setKept((lists) => [...lists, list]);
              onFollow(list, next);
            }}
          />
        </div>
      ) : (
        <p className="ui-info-note ui-follow-none">
          No events yet. Add them below, or turn on Notify me in any event.
        </p>
      )}
      <h3 className="ui-info-section ui-notify-section">Add events</h3>
      <div className="ui-info-card ui-info-links">
        {KIND_GROUPS.map(({ kind, name }) => {
          const ofKind = choices.filter((c) => underKind(c, kind));
          const following = ofKind.filter((c) => c.on).length;
          return (
            <button
              key={kind}
              type="button"
              className="ui-info-link ui-notify-kind"
              // Off, events can't be chosen: the kinds show their counts but don't open (owner,
              // 13 November 2026).
              disabled={!on}
              onClick={() => {
                onKind(kind);
              }}
            >
              <span className="ui-notify-sq" data-kind={kind} aria-hidden="true" />
              <span className="ui-info-text">
                {name}
                <small>
                  Following {following} of {ofKind.length}
                </small>
              </span>
              <ChevronRightIcon />
            </button>
          );
        })}
      </div>
      {/* Off, the line under the switch has already said it. */}
      {on && <p className="ui-info-note">Turn an event off to stop its notifications.</p>}
    </>
  );
}

/**
 * One of the list's kinds (NT-22), opened from Notifications: a sentence on what turning an
 * event on does, then every class, special event or prayer on the schedule, weekly ones
 * first, then one-time ones by date, each as a card like
 * the list's (EV-11) with its picture, where it is, when, and its switch, the same as Notify me
 * of changes in its panel. Every card is the same height; at very large text cards grow and
 * nothing is cut.
 */
export function KindEventsScreen(props: NotificationsProps & { kind: KindGroup }) {
  const { state, failed, choices, onFollow, kind } = props;
  // With notifications off the choices are kept and shown, and wait (NT-17).
  const busy = props.busy || state !== "on";
  const rows = choices.filter((c) => underKind(c, kind));
  return (
    <>
      {failed && (
        <p className="ui-notify-error" role="alert">
          Couldn’t change notifications. Check your connection and try again.
        </p>
      )}
      <p className="ui-follow-lead">
        Turn an event on to be reminded and kept up to date. We’ll remind you the day before, and a
        week before too for events that aren’t weekly.
      </p>
      {kind === "class" ? (
        CLASS_GROUPS.map(({ name, kinds }) => {
          const group = rows.filter((c) => kinds.includes(c.kind));
          return (
            group.length > 0 && (
              <section key={name} aria-label={name}>
                <h3 className="ui-info-section ui-follow-group">{name}</h3>
                <FollowList rows={group} busy={busy} onFollow={onFollow} />
              </section>
            )
          );
        })
      ) : (
        <FollowList rows={rows} busy={busy} onFollow={onFollow} />
      )}
      {rows.length === 0 && (
        <p className="ui-info-note" role="status">
          Nothing on the schedule now.
        </p>
      )}
    </>
  );
}

/**
 * The when line with what following covers in bold: "**Weekly** · Tuesdays, 5:00 PM",
 * "**One time** · …", "**2 times** · …" (owner, 13 November 2026).
 */
function When({ detail }: { detail: string }) {
  const at = detail.indexOf(" · ");
  if (at < 0) return <>{detail}</>;
  return (
    <>
      <b>{detail.slice(0, at)}</b>
      {detail.slice(at)}
    </>
  );
}

/**
 * A group's cards: each with its picture, where, when and its switch (NT-22); under Your
 * events, a line beside a bell with the reminders it sends (NT-47).
 */
function FollowList({
  rows,
  busy,
  reminders = false,
  onFollow,
}: {
  rows: readonly EventChoiceRow[];
  busy: boolean;
  reminders?: boolean;
  onFollow: (list: string, on: boolean) => void;
}) {
  return (
    <ul className="ui-follow-list">
      {rows.map((c) => (
        <li
          key={c.list}
          className="ui-follow-row"
          data-kind={c.kind ?? undefined}
          data-reminders={reminders || undefined}
        >
          <Thumb event={c} />
          <span className="ui-follow-bar" aria-hidden="true" />
          <span className="ui-follow-text">
            <span className="ui-follow-title">{c.title}</span>
            <span className="ui-follow-where">
              {c.place && (
                <span className="ui-place">
                  <PinIcon filled />
                  {c.place}
                </span>
              )}
              {c.online && (
                <span>
                  <ScreenIcon />
                  Online
                </span>
              )}
            </span>
            <span className="ui-follow-when">
              <When detail={c.detail} />
            </span>
            {reminders && c.reminders && (
              <span className="ui-follow-reminders">
                <BellIcon />
                {c.reminders}
              </span>
            )}
          </span>
          <Toggle
            on={c.on}
            label={c.title}
            disabled={busy}
            onChange={(next) => {
              onFollow(c.list, next);
            }}
          />
        </li>
      ))}
    </ul>
  );
}
