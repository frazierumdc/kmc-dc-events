import { useEffect, useId, useRef, type MouseEvent, type SyntheticEvent } from "react";

export interface Choice {
  label: string;
  href: string;
  /** Opens in a new view (a website); otherwise in the app's own window (a calendar file). */
  newView: boolean;
}

export interface ChoiceSheetProps {
  /** `Add to calendar`. */
  title: string;
  choices: readonly Choice[];
  /** Asked to close: Cancel, a choice made, the dimmed background, or Escape. */
  onClose: () => void;
}

/**
 * An action sheet (EV-35): one action, several places to go, as iPhone offers them. The
 * choices sit in a rounded group at the bottom with the title above them, and Cancel apart
 * below. It is a modal <dialog> over the details panel; focus starts on the title.
 */
export function ChoiceSheet({ title, choices, onClose }: ChoiceSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // jsdom has no showModal; real browsers all do.
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
    heading.current?.focus();
    return () => {
      if (typeof el.close === "function" && el.open) el.close();
    };
  }, []);

  // Escape: close this sheet only, not the details panel under it. React passes a
  // dialog's cancel and close events on to the dialogs around it, so they stop here.
  const cancel = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };
  const closed = (e: SyntheticEvent) => {
    e.stopPropagation();
  };
  // A tap on the dimmed background lands on the dialog itself.
  const tapOutside = (e: MouseEvent<HTMLDialogElement>) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };
  // The link is followed first; the sheet goes once it has been.
  const chosen = () => {
    setTimeout(onClose, 0);
  };

  return (
    <dialog
      ref={dialog}
      className="ui-choices"
      aria-labelledby={titleId}
      onCancel={cancel}
      onClose={closed}
      onClick={tapOutside}
    >
      <div className="ui-choices-panel">
        <div className="ui-choices-group">
          <p ref={heading} id={titleId} className="ui-choices-title" tabIndex={-1}>
            {title}
          </p>
          {choices.map((choice) => (
            <a
              key={choice.label}
              className="ui-choice"
              href={choice.href}
              {...(choice.newView ? { target: "_blank", rel: "noopener" } : {})}
              onClick={chosen}
            >
              {choice.label}
            </a>
          ))}
        </div>
        <button type="button" className="ui-choice ui-choice-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
