/** Whether the last thing the person did was a touch or a click, rather than a key. */
let pointerLast = false;
/** The element focus went back to after a touch, drawn with no ring. */
let quiet: HTMLElement | null = null;

/** The ring may show again: a key was pressed, or focus moved on within the page. */
function release() {
  if (quiet) delete quiet.dataset.quietFocus;
  quiet = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", () => (pointerLast = true), true);
  document.addEventListener(
    "keydown",
    () => {
      pointerLast = false;
      release();
    },
    true,
  );
  document.addEventListener(
    "focusin",
    (e) => {
      if (e.target !== quiet) release();
    },
    true,
  );
}

/**
 * Moves focus back to `el` after a panel closes: the row it was opened from (EV-36) or the
 * Settings gear (EV-41), so a screen reader or keyboard carries on from there. iPhone Safari draws the
 * keyboard ring on focus moved by script, so after a touch or click (✕, the dimmed
 * background, a drag down) `el` is marked with `data-quiet-focus` and theme.css draws no
 * ring. The mark stays when the app is left and opened again, when iPhone gives `el` its
 * focus back; it goes when a key is pressed or focus moves to something else, so after
 * Escape or Tab the ring shows as usual.
 */
export function returnFocus(el: HTMLElement): void {
  release();
  el.focus({ preventScroll: true });
  if (!pointerLast) return;
  el.dataset.quietFocus = "";
  quiet = el;
}
