import { useEffect, useRef, useState } from "react";
import { type InstallGuide } from "../install/guide.ts";
import {
  KIND_GROUPS,
  KindEventsScreen,
  NotificationsScreen,
  type KindGroup,
  type NotificationsProps,
} from "../notifications/NotificationsScreen.tsx";
import { Privacy } from "./Privacy.tsx";
import { PRIVACY } from "./privacy.ts";
import { ShareApp } from "./ShareApp.tsx";
import {
  AddHomeIcon,
  BackIcon,
  BellIcon,
  ChevronRightIcon,
  CloseIcon,
  ShieldIcon,
} from "../shared/icons.tsx";

/**
 * Settings' screens: its own, Privacy (IN-9), Notifications (NT-17) and its screens for the
 * list's kinds, Classes, Special and Prayers (NT-22).
 */
type View = "main" | "privacy" | "notifications" | KindGroup;
const isKind = (view: View): view is KindGroup => KIND_GROUPS.some((g) => g.kind === view);

export interface SettingsSheetProps {
  /** Id for the title, which names the dialog. */
  titleId: string;
  /** The app's icon. */
  icon: string;
  /** `Schedule updated October 26, 2026, 4:09 AM`; null before the schedule has loaded. */
  updated: string | null;
  /** The app's build. */
  version: string;
  /** Only for the words: "home screen" on Android, "Home Screen" on iPhone. */
  guide: InstallGuide;
  /** The page for people new to the app, /get-app (IN-10): Add to Home Screen opens it, and
   * Share the app sends it. */
  addLink: string;
  /** The Notifications screen (NT-17); null where notifications aren't possible: the row is
   * left out. */
  notifications: NotificationsProps | null;
  onClose: () => void;
}

/**
 * The Settings sheet (EV-41, NT-30), opened by the gear: the app's icon and name, when the schedule was updated, then
 * three rows: Add to Home Screen, which opens /get-app with the steps for this phone (IN-10);
 * Privacy, which opens the privacy page inside the sheet (IN-9); and Share the app, which
 * sends the link to /get-app (IN-10). The version is at the end. Whether the app is installed
 * is never checked: a line says that if it's already there, nothing more is needed (IN-1).
 */
export function SettingsSheet(props: SettingsSheetProps) {
  const { titleId, onClose } = props;
  const [chosen, setView] = useState<View>("main");
  // A kind's events can be chosen only with notifications on (owner, 13 November 2026); off,
  // refused or in Safari, Notifications says why not.
  const canChoose = props.notifications?.state === "on";
  const view = isKind(chosen) && !canChoose ? "notifications" : chosen;
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // Changing view moves focus to the new title, as a new screen does.
  useEffect(() => {
    if (moved.current) title.current?.focus({ preventScroll: true });
  }, [view]);
  const show = (next: View) => {
    moved.current = true;
    setView(next);
  };
  const titles: Record<View, string> = {
    main: "Settings",
    privacy: PRIVACY.title,
    notifications: "Notifications",
    class: "Classes",
    special: "Special Events",
    prayer: "Prayers",
  };
  const back: View = isKind(view) ? "notifications" : "main";
  return (
    <>
      <div className="ui-sheet-head ui-info-head">
        <span className="ui-grabber" aria-hidden="true" />
        {view !== "main" ? (
          <button
            type="button"
            className="ui-info-back"
            onClick={() => {
              show(back);
            }}
          >
            <BackIcon />
            {titles[back]}
          </button>
        ) : (
          <span />
        )}
        <h2 id={titleId} ref={title} tabIndex={-1}>
          {titles[view]}
        </h2>
        <button type="button" className="ui-sheet-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="ui-sheet-body ui-info">
        {view === "privacy" && <Privacy />}
        {view === "notifications" && props.notifications && (
          <NotificationsScreen
            {...props.notifications}
            onKind={(kind) => {
              show(kind);
            }}
          />
        )}
        {isKind(view) && props.notifications && (
          <KindEventsScreen {...props.notifications} kind={view} />
        )}
        {view === "main" && (
          <Main
            {...props}
            onPrivacy={() => {
              show("privacy");
            }}
            onNotifications={() => {
              props.notifications?.onOpen?.();
              show("notifications");
            }}
          />
        )}
      </div>
    </>
  );
}

function Main({
  icon,
  updated,
  version,
  guide,
  addLink,
  notifications,
  onPrivacy,
  onNotifications,
}: SettingsSheetProps & { onPrivacy: () => void; onNotifications: () => void }) {
  const android = guide === "android" || guide === "android-other";
  const home = android ? "home screen" : "Home Screen";
  return (
    <>
      <div className="ui-info-app">
        <img src={icon} alt="" width={72} height={72} />
        <div>
          <b>KMC DC Events</b>
          {updated !== null && <span>{updated}</span>}
        </div>
      </div>
      {notifications && (
        <div className="ui-info-card ui-info-links ui-notify-entry">
          <button type="button" className="ui-info-link" onClick={onNotifications}>
            <span className="ui-info-ic" data-tint="accent" aria-hidden="true">
              <BellIcon />
            </span>
            <span className="ui-info-text">
              Notifications
              <small>Changes to events, on this phone</small>
            </span>
            <span className="ui-info-value">{notifications.state === "on" ? "On" : "Off"}</span>
            <ChevronRightIcon />
          </button>
        </div>
      )}
      <div className="ui-info-card ui-info-links">
        <a className="ui-info-link" href={addLink}>
          <span className="ui-info-ic" data-tint="accent" aria-hidden="true">
            <AddHomeIcon />
          </span>
          <span className="ui-info-text">
            Add to {home}
            <small>Steps for your phone</small>
          </span>
          <ChevronRightIcon />
        </a>
      </div>
      <p className="ui-info-note">
        Opens full screen from its own icon and works with no connection. Already added? You’re all
        set.
      </p>
      <div className="ui-info-card ui-info-links">
        <button type="button" className="ui-info-link" onClick={onPrivacy}>
          <span className="ui-info-ic" data-tint="grey" aria-hidden="true">
            <ShieldIcon />
          </span>
          <span className="ui-info-text">{PRIVACY.title}</span>
          <ChevronRightIcon />
        </button>
        <ShareApp link={addLink} />
      </div>
      <p className="ui-info-version">Version {version}</p>
    </>
  );
}
