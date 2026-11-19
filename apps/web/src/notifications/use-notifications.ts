// The Notifications screen's state for React (NT-17, NT-18): read again whenever the app
// comes back to the screen, as the reader may have allowed or refused them in the phone's
// settings meanwhile. Choices and Turn off show at once and reach the service in the
// background (owner, 12 Nov). Turn on waits only for the phone's answer: on its yes they are
// on at once, and the code and the lists follow behind.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NotifyList } from "@kmcdc/domain";
import type { Follow } from "./follow.ts";
import {
  NOTHING_SAVED,
  leaveRetired,
  notifier,
  notifyState,
  type NotifyEnv,
  type NotifySaved,
  type NotifyState,
} from "./notifications.ts";

export function useNotifications(env: NotifyEnv) {
  const [state, setState] = useState<NotifyState>(() => notifyState(env));
  const [saved, setSaved] = useState<NotifySaved>(() => env.read() ?? NOTHING_SAVED);
  /** True while turning on. */
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") setState(notifyState(env));
    };
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
    };
  }, [env]);

  const notify = useMemo(
    () =>
      notifier(
        env,
        () => {
          setState(notifyState(env));
          setSaved(env.read() ?? NOTHING_SAVED);
        },
        () => {
          setFailed(true);
        },
      ),
    [env],
  );

  useEffect(() => {
    leaveRetired(env, notify);
  }, [env, notify]);

  const turnOn = useCallback(() => {
    setBusy(true);
    setFailed(false);
    notify
      .turnOn()
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setState(notifyState(env));
        setSaved(env.read() ?? NOTHING_SAVED);
        setBusy(false);
      });
  }, [env, notify]);

  /** Chooses a list; from an event's panel with notifications off, turns them on too. */
  const pick = useCallback(
    (list: NotifyList, on: boolean, follow?: Follow) => {
      setFailed(false);
      notify.choose(list, on, follow);
      if (on && notifyState(env) === "off") turnOn();
    },
    [env, notify, turnOn],
  );

  return {
    state,
    saved,
    busy,
    failed,
    turnOn,
    turnOff: useCallback(() => {
      setFailed(false);
      notify.turnOff();
    }, [notify]),
    pick,
    /** The Notifications screen opened: load the library ahead of the switch. */
    warm: useCallback(() => {
      const now = notifyState(env);
      if (now === "on" || now === "off") notify.warm();
    }, [env, notify]),
  };
}
