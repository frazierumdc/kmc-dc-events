import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** How long a message takes to leave; as its animation in messages.css (ms). */
const LEAVE_MS = 200;

/**
 * Shows `children`; when they go, the last ones stay a moment, hidden from screen readers
 * and taps, while messages.css fades them away (`.ui-leaving`): an iOS message drops and
 * fades, a Material snackbar fades (EV-19). One message replacing another swaps at
 * once.
 */
export function Leaving({ children }: { children?: ReactNode }) {
  const shown = Boolean(children);
  const last = useRef<ReactNode>(null);
  const [leaving, setLeaving] = useState<ReactNode>(null);
  useLayoutEffect(() => {
    if (shown) {
      last.current = children;
      return;
    }
    if (last.current === null) return;
    setLeaving(last.current);
    last.current = null;
    const timer = setTimeout(() => {
      setLeaving(null);
    }, LEAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shown, children]);
  if (shown) return children;
  if (leaving === null) return null;
  return (
    <div className="ui-leaving" aria-hidden="true" inert>
      {leaving}
    </div>
  );
}
