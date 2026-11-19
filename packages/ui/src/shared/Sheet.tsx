import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/** Longest the closing slide may take before the panel is removed anyway. */
const CLOSE_MS = 320;
/** Movement before a touch counts as a drag down or as a scroll (px). */
const DECIDE_PX = 8;
/** How far (px, at most this share of the panel), or how fast a flick (px, px/ms), closes. */
const CLOSE_PX = 160;
const CLOSE_SHARE = 0.35;
const FLICK_PX = 24;
const FLICK_SPEED = 0.5;
/** Springing back into place, as the panel slides in. */
const SETTLE = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";

export interface SheetProps {
  /** Shown while true; when it turns false the panel slides away, then goes. */
  open: boolean;
  /** Asked to close: ✕, the dimmed background, a drag down, Escape, or Android's Back. */
  onClose: () => void;
  /** After the panel has gone, for moving focus back. */
  onClosed?: () => void;
  /** Id of the element that names the dialog (EV-38). */
  labelledBy: string;
  /** Kept on screen while the panel slides away. */
  children: ReactNode;
}

/**
 * A panel that slides up from the bottom over the dimmed screen (EV-36), as iPhone sheets
 * and Material bottom sheets do. It is a modal <dialog>: the screen behind can't be
 * reached or scrolled, focus moves to the element naming it (give it tabIndex -1), and
 * Escape asks to close. The owner decides when it
 * closes, so closing can go through the browser's history first. While it is open, <html>
 * has `data-sheet` (the page behind doesn't scroll): one attribute on one element, so the
 * phone doesn't restyle the whole list as the panel starts to slide.
 */
export function Sheet({ open, onClose, onClosed, labelledBy, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  if (open && !present) setPresent(true);
  if (open && closing) setClosing(false);

  const handlers = useRef({ onClose, onClosed, open });
  useEffect(() => {
    handlers.current = { onClose, onClosed, open };
  }, [onClose, onClosed, open]);

  // Before the screen is drawn, so the slide starts on the next frame.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) {
      // Opened again while a drag had sent it away: back in its place.
      const moved = panel.current?.style;
      moved?.removeProperty("--sheet-from");
      moved?.removeProperty("animation-timing-function");
      moved?.removeProperty("transform");
      // jsdom has no showModal; real browsers all do.
      if (el.open) return;
      el.ownerDocument.documentElement.dataset.sheet = "";
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
      // Focus starts on the title, so a screen reader reads the event first (EV-38) and
      // no ring shows on ✕. The panel is still sliding in: focus mustn't scroll it.
      el.ownerDocument.getElementById(labelledBy)?.focus({ preventScroll: true });
      return;
    }
    const finish = (e?: Event) => {
      if (e && e.target !== el.firstElementChild) return;
      clearTimeout(timer);
      el.removeEventListener("animationend", finish);
      if (el.open) {
        if (typeof el.close === "function") el.close();
        else el.removeAttribute("open");
      }
      delete el.ownerDocument.documentElement.dataset.sheet;
      setClosing(false);
      setPresent(false);
      handlers.current.onClosed?.();
    };
    // Closed by the browser already: nothing to slide away.
    if (!el.open) {
      finish();
      return;
    }
    setClosing(true);
    const timer = setTimeout(finish, CLOSE_MS);
    el.addEventListener("animationend", finish);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("animationend", finish);
    };
  }, [open, present, labelledBy]);

  // Gone while open (the schedule failed under it): the page scrolls again.
  useEffect(() => {
    const root = dialog.current?.ownerDocument.documentElement;
    return () => {
      if (root) delete root.dataset.sheet;
    };
  }, [present]);

  // Drag down to close (EV-36), as iPhone sheets and Material bottom sheets do: from the
  // top (grabber, categories, ✕) at any time, or from anywhere once the panel is scrolled
  // to its top. The panel follows the finger; let go far or fast enough and it slides on
  // down from there, otherwise it springs back.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let start: { y: number; x: number } | null = null;
    let dragging = false;
    let dy = 0;
    let speed = 0;
    let last = { y: 0, t: 0 };
    let settle = 0;

    const place = (y: number) => {
      el.style.transform = y > 0.5 ? `translateY(${y.toFixed(1)}px)` : "";
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      // A touch in a panel inside this one (Add to calendar's choices) is that panel's.
      const own = target?.closest("dialog") === dialog.current;
      const fromTop = target?.closest(".ui-sheet-head") != null;
      start =
        e.touches.length === 1 && t && own && (fromTop || el.scrollTop <= 0)
          ? { x: t.clientX, y: t.clientY }
          : null;
      dragging = false;
      dy = 0;
      speed = 0;
      last = { y: 0, t: e.timeStamp };
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const down = t.clientY - start.y;
      if (!dragging) {
        const across = t.clientX - start.x;
        if (Math.abs(down) < DECIDE_PX && Math.abs(across) < DECIDE_PX) return;
        // Up, sideways, or the panel already scrolling: not a drag.
        if (down <= 0 || Math.abs(across) > down || !e.cancelable) {
          start = null;
          return;
        }
        dragging = true;
        clearTimeout(settle);
        el.style.transition = "";
        // Still sliding in: it ends where it is going, so the finger takes it from there.
        // jsdom has no getAnimations; real browsers all do.
        if ("getAnimations" in el) for (const a of el.getAnimations()) a.finish();
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, down);
      const dt = e.timeStamp - last.t;
      if (dt > 0) speed = 0.6 * ((dy - last.y) / dt) + 0.4 * speed;
      last = { y: dy, t: e.timeStamp };
      place(dy);
    };
    const onEnd = () => {
      if (!start || !dragging) {
        start = null;
        return;
      }
      start = null;
      dragging = false;
      // A drag is never a tap on what is under the finger.
      el.addEventListener("click", stopClick, { capture: true, once: true });
      setTimeout(() => {
        el.removeEventListener("click", stopClick, { capture: true });
      }, 400);
      const far =
        dy >= Math.min(CLOSE_PX, el.offsetHeight * CLOSE_SHARE) ||
        (dy >= FLICK_PX && speed >= FLICK_SPEED);
      if (far) {
        // The closing slide starts where the finger left the panel, without easing in.
        el.style.setProperty("--sheet-from", `${dy.toFixed(1)}px`);
        el.style.animationTimingFunction = "cubic-bezier(0.25, 0.8, 0.5, 1)";
        handlers.current.onClose();
        return;
      }
      springBack();
    };
    const springBack = () => {
      el.style.transition = SETTLE;
      place(0);
      settle = window.setTimeout(() => {
        el.style.transition = "";
      }, 300);
    };
    const onCancel = () => {
      if (dragging) springBack();
      start = null;
      dragging = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      clearTimeout(settle);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [present]);

  // Escape, and Back on Android, which Chrome turns into the dialog's cancel.
  const cancel = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    handlers.current.onClose();
  };
  // A tap on the dimmed background lands on the dialog itself, not on the panel.
  const tapOutside = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) handlers.current.onClose();
  };
  // Closed by the browser without a cancel it let us stop: catch up.
  const closedByBrowser = () => {
    if (handlers.current.open) handlers.current.onClose();
  };

  if (!present) return null;
  return (
    <dialog
      ref={dialog}
      className="ui-sheet"
      aria-labelledby={labelledBy}
      data-closing={closing || undefined}
      onCancel={cancel}
      onClose={closedByBrowser}
      onClick={tapOutside}
    >
      <div ref={panel} className="ui-sheet-panel">
        {children}
      </div>
    </dialog>
  );
}

function stopClick(e: Event) {
  e.stopPropagation();
  e.preventDefault();
}
