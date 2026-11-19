import { useEffect, useMemo } from "react";
import { calendarKind, type SnapshotV2, type SnapshotV2Event } from "@kmcdc/domain";
import type { FollowSwitch, InstallGuide, NotificationsProps } from "@kmcdc/ui";
import { onIphoneHomeScreen } from "../events/event-route.ts";
import { eventChoices, followFor, goneFollows, remindersLine } from "./follow.ts";
import { browserNotifyEnv } from "./notify-env.ts";
import { useNotifications } from "./use-notifications.ts";

export interface Follows {
  /** Settings' Notifications screen (NT-17); null where notifications aren't possible. */
  settings: NotificationsProps | null;
  /** Notify me in an event's panel (NT-13, NT-48); null where notifications can't be on. */
  followSwitch: (event: SnapshotV2Event) => FollowSwitch | null;
}

/**
 * Notifications on this phone (D65, NT-17), off until the reader turns them on, and the
 * events followed, for the two places that show them: Settings and an event's panel.
 */
export function useFollows(snapshot: SnapshotV2 | null, guide: InstallGuide): Follows {
  const notifyEnv = useMemo(
    () => browserNotifyEnv(__PUSH_CONFIG__, guide, onIphoneHomeScreen()),
    [guide],
  );
  const notify = useNotifications(notifyEnv);
  /** Add events' rows (NT-22): every event and series on the schedule now. */
  const choices = useMemo(
    () => (snapshot ? eventChoices(snapshot.events, snapshot.site) : []),
    [snapshot],
  );
  // A followed event that has left the schedule is forgotten, and its list left (NT-17).
  const { pick, saved } = notify;
  useEffect(() => {
    if (!snapshot || snapshot.events.length === 0) return;
    for (const list of goneFollows(saved.lists, snapshot.events)) pick(list, false);
  }, [snapshot, saved.lists, pick]);

  const followSwitch = (event: SnapshotV2Event): FollowSwitch | null => {
    if (!snapshot || (notify.state !== "on" && notify.state !== "off")) return null;
    const { site } = snapshot;
    const kind = calendarKind(event, site);
    const choice = followFor(
      event,
      snapshot.events,
      site.programs,
      // What one session is called in the panel's line (NT-48).
      kind === "prayer" ? "prayer" : kind === "special" ? "session" : "class",
    );
    return {
      on: notify.state === "on" && notify.saved.lists.includes(choice.list),
      detail: choice.panel,
      busy: notify.busy,
      onChange: (on) => {
        notify.pick(choice.list, on, choice);
      },
    };
  };

  const settings: NotificationsProps | null =
    notify.state === "unavailable"
      ? null
      : {
          state: notify.state,
          busy: notify.busy,
          failed: notify.failed,
          android: guide === "android" || guide === "android-other",
          addLink: `${window.location.origin}/get-app`,
          choices: choices.map((c) => ({
            ...c,
            reminders: remindersLine(c),
            on: notify.saved.lists.includes(c.list),
          })),
          onFollow: (list, on) => {
            const choice = choices.find((c) => c.list === list);
            if (choice)
              notify.pick(choice.list, on, {
                list: choice.list,
                title: choice.title,
                detail: choice.detail,
              });
          },
          onOpen: notify.warm,
          onTurnOn: notify.turnOn,
          onTurnOff: notify.turnOff,
        };
  return { settings, followSwitch };
}
