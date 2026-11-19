import { useCallback, useMemo, useState, type RefObject } from "react";
import { returnFocus, type InstallGuide } from "@kmcdc/ui";
import { installGuide } from "../install/install-guide.ts";

export interface SettingsState {
  open: boolean;
  show: () => void;
  close: () => void;
  /** After the sheet has gone: focus returns to the gear. */
  closed: () => void;
  /** This browser's steps; in Settings only its words differ ("home screen" on Android). */
  guide: InstallGuide;
}

/**
 * Settings (EV-41): whether its sheet is open, and which browser this is. `button` is the
 * gear in the top bar, which takes focus back when the sheet has gone.
 */
export function useSettings(button: RefObject<HTMLButtonElement | null>): SettingsState {
  const [open, setOpen] = useState(false);
  const guide = useMemo(
    () => installGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    [],
  );
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const closed = useCallback(() => {
    if (button.current) returnFocus(button.current);
  }, [button]);
  return { open, show, close, closed, guide };
}
