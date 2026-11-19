import { useEffect, useLayoutEffect, useRef } from "react";

export interface StripDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `Mon`. */
  weekday: string;
  /** `5`. */
  day: string;
  /** `Oct 2026` above the first date and each 1st. */
  month: string | null;
  isToday: boolean;
  /** One dot per matching event, at most three: each event's kind, or null for none. */
  dots: readonly ("class" | "special" | "prayer" | null)[];
  /** `Monday, October 5, 2026, 3 events`. */
  label: string;
}

export interface DateStripProps {
  days: readonly StripDay[];
  /** The day at the top of the list. */
  current: string | null;
  /** Called with the date tapped. */
  onPick: (date: string) => void;
  /**
   * The kind filter: when it changes the marked date, the fill slides from the old date to
   * the new one (both in view, not with Reduce Motion); scrolling changes it at once.
   */
  slideKey?: string;
}

/** Room left beside a date the row scrolls to, as the row's own side padding. */
const EDGE_PX = 16;
/** Marked dates changing faster than this (a fast scroll of the list) jump, not slide. */
const QUICK_MS = 300;
/** How long the fill takes to slide to a new filter's date (date-strip.css). */
const PILL_MS = 250;
/** After the marked date stops changing (and a slide has ended), the row is checked again. */
const SETTLE_MS = 700;

/**
 * Where the row should scroll so a date is in view, or null when it already is: at the
 * start going forward (the date was past the end), at the end going back. Every number is
 * from the row's own layout, never from the screen, so a target is the same however far a
 * slide in progress has got.
 */
export function stripTarget(
  scrollLeft: number,
  width: number,
  dateLeft: number,
  dateWidth: number,
): number | null {
  if (dateLeft + dateWidth > scrollLeft + width - EDGE_PX) return dateLeft - EDGE_PX;
  if (dateLeft < scrollLeft + EDGE_PX) return dateLeft + dateWidth - width + EDGE_PX;
  return null;
}

/**
 * The sideways row of dates (EV-13, EV-14): it follows the list, marking the day at the
 * top, and tapping a date moves the list to that day. Each date is read with its event
 * count (NFR-2); its dots take the colours of its events' kinds (D45). When the marked day
 * leaves the row's view, the row scrolls so it shows at the side the list is heading to:
 * at the start going forward, at the end going back. It slides to a nearby date; during a
 * fast scroll of the list, to a far date or with Reduce Motion, it jumps. Once the marked
 * date has stopped changing, the row is checked again, so a slide the phone cut short
 * can't leave it out of view. The month in view stays at the row's start as it scrolls,
 * until the next month's name pushes it out.
 */
export function DateStrip({ days, current, onPick, slideKey }: DateStripProps) {
  const row = useRef<HTMLDivElement>(null);
  const lastChange = useRef(0);
  const before = useRef({ current, slideKey });

  // Before the new date is drawn marked: a new filter slides the fill over from the old one.
  useLayoutEffect(() => {
    const was = before.current;
    before.current = { current, slideKey };
    const strip = row.current;
    if (!strip || was.slideKey === slideKey || was.current === null || was.current === current)
      return;
    if (strip.clientWidth === 0) return; // not drawn
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = strip.querySelector<HTMLElement>(`[data-date="${was.current}"]`);
    const to = strip.querySelector<HTMLElement>('[aria-current="true"]');
    if (!from || !to) return;
    const inView = (el: HTMLElement) =>
      stripTarget(strip.scrollLeft, strip.clientWidth, el.offsetLeft, el.offsetWidth) === null;
    if (!inView(from) || !inView(to)) return;
    to.style.setProperty("--pill-from", `${String(from.offsetLeft - to.offsetLeft)}px`);
    to.getBoundingClientRect(); // the fill starts on the old date
    strip.dataset.pill = "";
    to.style.removeProperty("--pill-from");
    const done = setTimeout(() => {
      delete strip.dataset.pill;
    }, PILL_MS);
    return () => {
      clearTimeout(done);
      delete strip.dataset.pill;
    };
  }, [current, slideKey]);

  useEffect(() => {
    const strip = row.current;
    if (!strip || strip.clientWidth === 0) return; // not drawn
    const follow = (slide: boolean) => {
      const date = strip.querySelector<HTMLElement>('[aria-current="true"]');
      if (!date) return;
      const target = stripTarget(
        strip.scrollLeft,
        strip.clientWidth,
        date.offsetLeft,
        date.offsetWidth,
      );
      if (target === null) return;
      const near = Math.abs(target - strip.scrollLeft) <= strip.clientWidth;
      strip.scrollTo({ left: target, behavior: slide && near ? "smooth" : "instant" });
    };
    const now = performance.now();
    const quick = now - lastChange.current < QUICK_MS;
    lastChange.current = now;
    follow(!quick && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const settle = setTimeout(() => {
      follow(false);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
    };
  }, [current]);

  return (
    <div ref={row} className="ui-strip" role="group" aria-label="Choose a day">
      {months(days).map((m) => (
        <div className="ui-monthdays" key={m[0].date}>
          <span className="ui-month" aria-hidden="true">
            {m[0].month}
          </span>
          <div className="ui-monthrow">
            {m.map((d) => (
              <button
                type="button"
                key={d.date}
                className={d.isToday ? "ui-date ui-today" : "ui-date"}
                data-date={d.date}
                aria-current={d.date === current ? "true" : undefined}
                aria-label={d.label}
                onClick={() => {
                  onPick(d.date);
                }}
              >
                <span className="ui-dw">{d.weekday}</span>
                <span className="ui-dn">{d.day}</span>
                <span className="ui-dots">
                  {d.dots.map((kind, i) => (
                    <i key={i} data-kind={kind ?? undefined} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The days split where a month name starts: the first day and each 1st. */
function months(days: readonly StripDay[]): [StripDay, ...StripDay[]][] {
  const out: [StripDay, ...StripDay[]][] = [];
  for (const d of days) {
    const last = out.at(-1);
    if (last && d.month === null) last.push(d);
    else out.push([d]);
  }
  return out;
}
