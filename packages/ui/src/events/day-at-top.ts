import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** The id of a day's heading in the list; its <section> is the heading's parent. */
export function dayId(date: string): string {
  return `day-${date}`;
}

/**
 * The first of `count` days whose bottom is below `line`, or the last when none is;
 * `bottom(i)` grows with `i`, so a few reads find it however long the list.
 */
export function firstBelow(count: number, bottom: (i: number) => number, line: number): number {
  let found = count - 1;
  let lo = 0;
  let hi = count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bottom(mid) > line) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return Math.max(0, found);
}

/**
 * The listed day a date leads to (EV-14): that date, or for a date with nothing listed the
 * next listed day, or the last one when none comes after.
 */
export function listedFrom(listed: readonly string[], date: string): string | null {
  return listed.find((d) => d >= date) ?? listed.at(-1) ?? null;
}

/** A day showing less than this under the line counts as gone. */
const SLACK_PX = 2;
/** Frames after a jump in which the day is put back under the controls if it moved. */
const SETTLE_FRAMES = 3;
/** Days drawn at once from the day moved to, so the screen is never shown undrawn. */
const NEAR_DAYS = 4;

/**
 * The day at the top of the list (EV-14): the first listed day with anything still showing
 * below the controls that stay on screen, so it is always the first date the reader sees.
 * The list ends with just enough room for its last day to reach the top, so every date can
 * be moved to the top and marked by scrolling.
 * `jumpTo` moves the list so a day starts just under the controls, in one step: a sliding
 * scroll would pass every day between and the row of dates would flicker; focus moves to
 * its heading, for screen readers. When `filter` changes, the list keeps its date: the
 * marked day (or the next one the new filter lists) starts just under the controls, marked
 * at once. A day moved to stays marked until the reader scrolls, even near the end of the
 * list, where the last days can't reach the top, and is put back if the list is redrawn under it;
 * a scroll the reader makes without touching the list (a tap on iPhone's status bar, which
 * scrolls to the top) lets the list lead again too. The day moved to and the few after it are
 * drawn at once (`data-near`), not when they come near. While a finger swipes the list
 * sideways (`data-swiping` on <html>) the marked day holds still.
 */
export function useDayAtTop(
  dates: readonly string[],
  filter: string,
): {
  current: string | null;
  jumpTo: (date: string) => void;
} {
  // The day at the top as last measured, and the day the list was moved to, which wins
  // until the reader's own touch, wheel or key (while the new list still has it).
  const [measured, setMeasured] = useState<string | null>(dates[0] ?? null);
  const [held, setHeld] = useState<string | null>(null);
  const holding = useRef<string | null>(null);
  // Where the list was put for the day held, to tell the reader's own scroll from ours.
  const heldAt = useRef(0);
  const current = held !== null && dates.includes(held) ? held : measured;
  // The day marked now, and when a finger last came down, for a sideways swipe.
  const marked = useRef(current);
  const atTouch = useRef(current);
  useLayoutEffect(() => {
    marked.current = current;
  }, [current]);

  // A new filter keeps the date, decided while drawing, so the row and the list change
  // together; the list is moved once it is drawn (below).
  const [shownFilter, setShownFilter] = useState(filter);
  const [anchor, setAnchor] = useState<{ date: string } | null>(null);
  if (filter !== shownFilter) {
    setShownFilter(filter);
    // The date marked under the old filter: the held one may not be in the new list.
    const marked = held ?? measured;
    const to = marked === null ? (dates[0] ?? null) : listedFrom(dates, marked);
    setHeld(to);
    setAnchor(to === null ? null : { date: to });
  }

  const measure = useCallback(() => {
    if (document.documentElement.dataset.swiping !== undefined) return;
    makeRoomAtEnd(dates.at(-1));
    if (dates.length === 0 || window.scrollY <= 0) {
      setMeasured(dates[0] ?? null);
      return;
    }
    const line = (controls()?.getBoundingClientRect().bottom ?? 0) + SLACK_PX;
    const i = firstBelow(dates.length, (j) => dayRect(dates[j])?.bottom ?? 0, line);
    setMeasured(dates[i] ?? null);
  }, [dates]);

  /** Puts `date` just under the controls, if the list has moved it. */
  const align = useCallback(
    (date: string) => {
      makeRoomAtEnd(dates.at(-1));
      const top = dayRect(date)?.top ?? 0;
      const target = date === dates[0] ? 0 : window.scrollY + top - stuckBottom();
      if (Math.abs(target - window.scrollY) >= 1) {
        window.scrollTo({ top: target, behavior: "instant" });
      }
      heldAt.current = window.scrollY;
    },
    [dates],
  );

  /** Moves the list so `date` starts just under the controls, and keeps it there. */
  const moveTo = useCallback(
    (date: string) => {
      holding.current = date;
      // Days off screen are laid out at an estimated height until they come near, so the
      // day may move once those near it are drawn: put it back for a few frames.
      const settle = (framesLeft: number) => {
        if (holding.current !== date) {
          drawNear(null);
          return;
        }
        drawNear(date);
        align(date);
        if (framesLeft > 0)
          requestAnimationFrame(() => {
            settle(framesLeft - 1);
          });
        else drawNear(null);
      };
      settle(SETTLE_FRAMES);
    },
    [align],
  );

  useLayoutEffect(() => {
    if (anchor) moveTo(anchor.date);
  }, [anchor, moveTo]);

  useEffect(() => {
    const root = document.documentElement;
    // A new list: measure once it's drawn.
    let frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
    // The reader's own touch, wheel or key lets the list lead again.
    const release = () => {
      holding.current = null;
      setHeld(null);
    };
    const onScroll = () => {
      // A tap on the status bar scrolls up with no touch on the page: the list moving up
      // from where it was put lets the list lead, before a redraw can put the day back.
      if (
        holding.current !== null &&
        root.dataset.swiping === undefined &&
        heldAt.current - window.scrollY > SLACK_PX
      ) {
        release();
      }
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    const touched = () => {
      atTouch.current = marked.current;
      release();
    };
    // A sideways swipe keeps the day marked when the finger came down, whatever the list
    // drifted before the swipe was told from a scroll; measure again once it ends.
    const swipes =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (root.dataset.swiping === undefined) onScroll();
            else setMeasured(atTouch.current);
          });
    swipes?.observe(root, { attributes: true, attributeFilter: ["data-swiping"] });
    const input = { capture: true, passive: true } as const;
    // Days coming near the screen are drawn at their real height, which moves the days
    // below without a scroll, sometimes after the frames `moveTo` settles in (a slow
    // phone): a day moved to is put back under the controls, then measured again.
    const resized =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const day = holding.current;
            if (day !== null && dates.includes(day) && root.dataset.swiping === undefined) {
              align(day);
            }
            onScroll();
          });
    resized?.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("pointerdown", release, input);
    window.addEventListener("touchstart", touched, input);
    window.addEventListener("wheel", release, input);
    window.addEventListener("keydown", release, input);
    return () => {
      cancelAnimationFrame(frame);
      resized?.disconnect();
      swipes?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointerdown", release, input);
      window.removeEventListener("touchstart", touched, input);
      window.removeEventListener("wheel", release, input);
      window.removeEventListener("keydown", release, input);
    };
  }, [dates, measure, align]);

  const jumpTo = useCallback(
    (date: string) => {
      setHeld(date);
      moveTo(date);
      const heading = document.getElementById(dayId(date));
      heading?.focus({ preventScroll: true });
    },
    [moveTo],
  );

  return { current, jumpTo };
}

/** The room added after the list, as `--end-space` on <html>. */
let endSpace = 0;

/** Sets the room after the list so the last day can scroll up to the controls. */
function makeRoomAtEnd(last: string | undefined) {
  const rect = dayRect(last);
  const root = document.documentElement;
  const top = rect ? window.scrollY + rect.top : 0;
  const needed = rect
    ? Math.max(
        0,
        Math.ceil(top - stuckBottom() + window.innerHeight - (root.scrollHeight - endSpace)),
      )
    : 0;
  if (Math.abs(needed - endSpace) < 1) return;
  endSpace = needed;
  root.style.setProperty("--end-space", `${String(needed)}px`);
}

/** The days drawn at once, from the day moved to; none once the list has settled. */
let near: HTMLElement[] = [];

function drawNear(date: string | null) {
  for (const day of near) delete day.dataset.near;
  near = [];
  let day = date === null ? null : (document.getElementById(dayId(date))?.parentElement ?? null);
  while (day?.classList.contains("ui-day") && near.length < NEAR_DAYS) {
    day.dataset.near = "";
    near.push(day);
    day = day.nextElementSibling as HTMLElement | null;
  }
}

function controls(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".ui-controls");
}

/** Where a day's section is on screen. */
function dayRect(date: string | undefined): DOMRect | null {
  const heading = date === undefined ? null : document.getElementById(dayId(date));
  return heading?.parentElement?.getBoundingClientRect() ?? null;
}

/** Where the controls end once the large title has gone under the bar. */
function stuckBottom(): number {
  const bar = document.querySelector<HTMLElement>(".ui-topbar");
  const height = (el: HTMLElement | null | undefined) => el?.getBoundingClientRect().height ?? 0;
  return height(bar) + height(controls());
}
