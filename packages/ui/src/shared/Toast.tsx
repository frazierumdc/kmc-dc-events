import { CheckIcon, CloseIcon } from "./icons.tsx";
import { Leaving } from "./Leaving.tsx";

/**
 * A message at the bottom of the screen that stays until the reader closes it with ✕:
 * "Schedule updated" (EV-19), on a neutral card with a round check badge. The live region
 * is always in the page, so screen readers announce each new message; it shows only while
 * there is one, and fades away when it goes.
 */
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <div className="ui-toastslot" role="status">
      <Leaving>
        {message && (
          <p className="ui-toast">
            <span className="ui-toast-badge">
              <CheckIcon />
            </span>
            <span className="ui-toast-text">{message}</span>
            <button type="button" className="ui-toast-close" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </p>
        )}
      </Leaving>
    </div>
  );
}
