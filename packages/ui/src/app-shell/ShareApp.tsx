import { useEffect, useRef, useState } from "react";
import { COPIED_MS } from "../shared/copied.ts";
import { ShareIcon } from "../shared/icons.tsx";

/**
 * Share the app (IN-10): the phone's own share menu with the link to /get-app, whose preview
 * shows the app's icon; where there is no menu, the link is copied. Handed over as text, as
 * an event's Share does (EV-35).
 */
export function ShareApp({ link }: { link: string }) {
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
        await navigator.share({ text: link });
      } catch {
        // Closed without sharing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
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
    <button type="button" className="ui-info-link" onClick={() => void share()}>
      <span className="ui-info-ic" data-tint="teal" aria-hidden="true">
        <ShareIcon />
      </span>
      <span className="ui-info-text">
        <span aria-live="polite">{copied ? "Link copied" : "Share the app"}</span>
        <small>Send someone the link to add it</small>
      </span>
    </button>
  );
}
