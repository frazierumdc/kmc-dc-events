import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { reducedMotion } from "../shared/motion.ts";

/** Swipes starting this close to a screen edge belong to the phone (back gestures). */
const EDGE_PX = 20;
/** Movement before a touch counts as sideways or as a scroll. */
const DECIDE_PX = 10;
/** How far, or how fast a flick, a finger must go for the next filter (px, px/ms). */
const COMMIT_PX = 60;
const FLICK_PX = 24;
const FLICK_SPEED = 0.4;
/** The list follows the finger this much, at most this far; past an end, less. */
const FOLLOW = 0.4;
const FOLLOW_MAX = 80;
const PAST_END = 0.3;
/** A finger moving this far moves the filter's selection one whole choice. */
const CHOICE_PX = 160;
/** The list leaves this far to the side, and comes in from this far on the other. */
const OUT_PX = 72;
const IN_PX = 48;
/** The slowest the list leaves (px/ms), and the shortest and longest it takes (ms). */
const OUT_MIN_SPEED = 0.5;
/** How fast the list leaves for a tapped filter (px/ms): 120 ms. */
const TAP_SPEED = 0.6;
const OUT_MS = [60, 180] as const;
/** How long the next filter's list takes to show fully as it comes in (ms). */
const FADE_IN_MS = 150;
/** Frames the next filter's list stays hidden while it is drawn and moved to its date. */
const DRAW_FRAMES = 2;
/** The spring the list settles with: stiffness (1/s²) and damping ratio. */
const STIFFNESS = 300;
const DAMPING = 0.85;

export interface SwipeTabsHandle {
  /**
   * Slides the list as a swipe would for a filter chosen another way (a tap): out toward
   * `step` (+1 a later filter, -1 an earlier one), `change()` while it is hidden, then in.
   */
  slide: (step: 1 | -1, change: () => void) => void;
}

export interface SwipeTabsProps {
  /** Asked for the next filter (+1, a finger moving right to left) or the previous one (-1). */
  onSwipe: (step: 1 | -1) => void;
  /** At the first or last filter, a swipe past it only stretches and springs back. */
  atStart: boolean;
  atEnd: boolean;
  /** For sliding the list to a tapped filter. */
  ref?: Ref<SwipeTabsHandle>;
  children: ReactNode;
}

/**
 * Swipe the list sideways to change the kind filter (EV-12), as tabs work on iPhone and
 * Android: a finger moving right to left goes to the next filter, left to right to the
 * previous one, stopping at All and Prayers. The list follows the finger a little, and the
 * filter's selection with it: on <html>, `--swipe` is how far toward the next choice (-1 to
 * 1), `data-swiping` is set while the finger or the list moves, and `data-swipe-to`
 * ("next" or "prev") once letting go would change the filter. Let go far or fast enough
 * and the list leaves at the finger's speed while the next filter's list comes in from the
 * other side on a spring; otherwise it springs back, keeping the finger's speed. While the
 * list is drawn, hidden, `data-switching` is set on <html>: the next list comes in only once
 * it has been drawn, so the screen never shows a frame with nothing drawn. The list doesn't scroll
 * up or down during a swipe, so the marked date holds still. Up-and-
 * down scrolling, pulling to refresh, taps, the row of dates and the phone's edge gestures
 * are left alone; with Reduce Motion nothing slides. A tapped filter slides the list the
 * same way (`ref.slide`): one short slide toward it, however many filters it jumps.
 */
export function SwipeTabs({ onSwipe, atStart, atEnd, ref, children }: SwipeTabsProps) {
  const area = useRef<HTMLDivElement>(null);
  const props = useRef({ onSwipe, atStart, atEnd });
  const slider = useRef<SwipeTabsHandle["slide"] | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      slide: (step, change) => {
        if (slider.current) slider.current(step, change);
        else change();
      },
    }),
    [],
  );
  useEffect(() => {
    props.current = { onSwipe, atStart, atEnd };
  }, [onSwipe, atStart, atEnd]);

  // Before the list is first drawn, so a swipe the moment it shows is never missed.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const root = document.documentElement;
    let start: { x: number; y: number } | null = null;
    /** Where the page was scrolled when the finger came down. */
    let startScroll = 0;
    let sideways = false;
    let dx = 0;
    /** The finger's speed (px/ms), from its last moves. */
    let speed = 0;
    let last = { x: 0, t: 0 };
    let frame = 0;
    /** Ends the running animation at once, as if it had finished. */
    let finish: (() => void) | null = null;

    /** +1 for the next filter, -1 for the previous, or 0 past either end. */
    const stepFor = (x: number): 1 | -1 | 0 => {
      if (x < 0) return props.current.atEnd ? 0 : 1;
      return props.current.atStart ? 0 : -1;
    };
    /** Where the list and the selection are now. */
    const now = { x: 0, choice: 0 };
    const show = (x: number, opacity: number, choice: number) => {
      now.x = x;
      now.choice = choice;
      el.style.transform = Math.abs(x) < 0.5 ? "" : `translateX(${x.toFixed(1)}px)`;
      el.style.opacity = opacity >= 1 ? "" : opacity.toFixed(3);
      root.style.setProperty("--swipe", choice.toFixed(4));
    };
    const done = () => {
      show(0, 1, 0);
      root.style.removeProperty("--swipe");
      delete root.dataset.swiping;
      delete root.dataset.swipeTo;
      delete root.dataset.switching;
      finish = null;
    };
    /** Undoes any scroll up or down since the finger came down. */
    const holdScroll = () => {
      if (Math.abs(window.scrollY - startScroll) >= 1) {
        window.scrollTo({ top: startScroll, behavior: "instant" });
      }
    };

    /** Runs `step(t)` each frame (t in ms from now) until it returns false. */
    const run = (step: (t: number) => boolean, end: () => void) => {
      const begin = performance.now();
      finish = () => {
        cancelAnimationFrame(frame);
        end();
      };
      const tick = (now: number) => {
        if (step(now - begin)) frame = requestAnimationFrame(tick);
        else end();
      };
      frame = requestAnimationFrame(tick);
    };
    /** A spring from `from` to 0 starting at `velocity` (px/ms); calls `each` with x. */
    const spring = (
      from: number,
      velocity: number,
      each: (x: number, t: number) => void,
      end: () => void,
    ) => {
      let x = from;
      let v = velocity * 1000; // px/s
      let prev = 0;
      const c = 2 * Math.sqrt(STIFFNESS) * DAMPING;
      run((t) => {
        const dt = Math.min(0.032, (t - prev) / 1000);
        prev = t;
        v += (-STIFFNESS * x - c * v) * dt;
        x += v * dt;
        each(x, t);
        return Math.abs(x) > 0.5 || Math.abs(v) > 10;
      }, end);
    };

    const onStart = (e: TouchEvent) => {
      while (finish) finish();
      const t = e.touches[0];
      const inDialog = e.target instanceof Element && e.target.closest("dialog") !== null;
      start =
        e.touches.length === 1 &&
        t &&
        !inDialog &&
        t.clientX > EDGE_PX &&
        t.clientX < window.innerWidth - EDGE_PX
          ? { x: t.clientX, y: t.clientY }
          : null;
      startScroll = window.scrollY;
      sideways = false;
      dx = 0;
      speed = 0;
      last = { x: 0, t: e.timeStamp };
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!sideways) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
        // Mostly up or down, or the page already scrolling: a scroll, not a swipe.
        if (Math.abs(dx) < Math.abs(dy) * 1.5 || !e.cancelable) {
          start = null;
          return;
        }
        sideways = true;
        root.dataset.swiping = "";
        holdScroll();
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - last.t;
      if (dt > 0) speed = 0.6 * ((dx - last.x) / dt) + 0.4 * speed;
      last = { x: dx, t: e.timeStamp };
      const step = stepFor(dx);
      const give = step === 0 ? PAST_END : 1;
      const x = Math.max(-FOLLOW_MAX, Math.min(FOLLOW_MAX, dx * FOLLOW * give));
      const choice = Math.max(-1, Math.min(1, (-dx / CHOICE_PX) * (step === 0 ? 0.15 : 1)));
      show(x, 1, choice);
      const far = Math.abs(dx) >= COMMIT_PX;
      if (far && step !== 0) root.dataset.swipeTo = step > 0 ? "next" : "prev";
      else delete root.dataset.swipeTo;
    };
    const onEnd = () => {
      if (!start || !sideways) {
        start = null;
        return;
      }
      start = null;
      sideways = false;
      holdScroll();
      // A swipe is never a tap on the row under the finger.
      el.addEventListener("click", stopClick, { capture: true, once: true });
      setTimeout(() => {
        el.removeEventListener("click", stopClick, { capture: true });
      }, 400);

      const { x: x0, choice: choice0 } = now;
      const listSpeed = speed * FOLLOW;
      const step = stepFor(dx);
      const far =
        Math.abs(dx) >= COMMIT_PX || (Math.abs(dx) >= FLICK_PX && Math.abs(speed) >= FLICK_SPEED);
      const motion = !reducedMotion();

      if (!far || step === 0) {
        delete root.dataset.swipeTo;
        if (!motion) {
          done();
          return;
        }
        spring(
          x0,
          listSpeed,
          (x) => {
            show(x, 1, x0 === 0 ? 0 : (choice0 * x) / x0);
          },
          done,
        );
        return;
      }

      root.dataset.swipeTo = step > 0 ? "next" : "prev";
      const change = () => {
        flushSync(() => {
          props.current.onSwipe(step);
        });
        // The new choice is selected now: nothing is waiting to be chosen.
        delete root.dataset.swipeTo;
      };
      if (!motion) {
        change();
        done();
        return;
      }
      // Out at the finger's speed (at least a brisk one), the selection moving all the way.
      swap(step, x0, choice0, step, Math.max(OUT_MIN_SPEED, Math.abs(listSpeed)), change);
    };

    /**
     * The list leaves toward `step` from `x0` at `pace` (px/ms), fading, while the
     * selection moves from `choice0` to `choiceTo`; then `change()` while it is hidden, and
     * once the next list has been drawn at its date it comes in from the other side on a
     * spring, keeping the speed.
     */
    const swap = (
      step: 1 | -1,
      x0: number,
      choice0: number,
      choiceTo: number,
      pace: number,
      change: () => void,
    ) => {
      const target = -step * OUT_PX;
      const ms = Math.max(OUT_MS[0], Math.min(OUT_MS[1], Math.abs(target - x0) / pace));
      run(
        (t) => {
          const p = Math.min(1, t / ms);
          const ease = 1 - (1 - p) * (1 - p);
          show(x0 + (target - x0) * ease, 1 - ease, choice0 + (choiceTo - choice0) * ease);
          return p < 1;
        },
        () => {
          root.dataset.switching = "";
          change();
          show(step * IN_PX, 0, 0);
          let frames = DRAW_FRAMES;
          run(
            () => --frames > 0,
            () => {
              // Drawn: the bars blur it again as it comes in, not once it has settled.
              delete root.dataset.switching;
              spring(
                step * IN_PX,
                -step * pace,
                (x, t) => {
                  show(x, Math.min(1, t / FADE_IN_MS), 0);
                },
                done,
              );
            },
          );
        },
      );
    };

    // A tapped filter: its segment or button is selected already, so only the list moves.
    slider.current = (step, change) => {
      while (finish) finish();
      const commit = () => {
        flushSync(change);
      };
      if (reducedMotion()) {
        commit();
        return;
      }
      swap(step, 0, 0, 0, TAP_SPEED, commit);
    };

    const onCancel = () => {
      if (sideways) {
        delete root.dataset.swipeTo;
        done();
      }
      start = null;
      sideways = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      slider.current = null;
      while (finish) finish();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  return (
    <div ref={area} className="ui-swipe">
      {children}
    </div>
  );
}

function stopClick(e: Event) {
  e.stopPropagation();
  e.preventDefault();
}
