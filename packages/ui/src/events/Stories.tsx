import { PauseIcon, PlayIcon } from "../shared/icons.tsx";
import { useEffect, useRef, useState } from "react";

/** One featured event in the gallery (EV-44). */
export interface Story {
  id: string;
  title: string;
  /** "Sun, Nov 29, 2026 · 10:00 – 11:15 AM". */
  when: string;
  /** "KMC DC", "Exampleville"; null for none. */
  where: string | null;
  /** Its large picture on the app's own site; null when it has none. */
  picture: string | null;
  /** Register, or More info: the event's page. */
  link: { label: string; href: string };
  /** Its kind and own colour (D45, D67), for its tag. */
  kind: string | null;
  tone?: string | null;
  /** The tag's words: "Special event", "Class", "Prayers"; null for none. */
  tag: string | null;
}

/** How long each event shows (owner, 15 November 2026). */
export const STORY_MS = 5000;
/** A swipe this far sideways moves to the next or the earlier event. */
const SWIPE_PX = 50;

/**
 * The splash as a gallery of featured events (EV-44), option B of the mock-ups: each
 * event's picture whole over a blurred copy of itself, ending in rounded corners, then its tag,
 * title, when and where, Register and See all events. Only the picture and the words change
 * from one event to the next: the frame, the dots and the buttons stay where they are. The
 * words follow a template (a tag, a title of 3 lines, a when of 2, a where of 1) that grows
 * to the longest event's when one needs more. An event with no picture shows the center's logo. Each shows for 5 seconds, then the
 * next; after the last, the app. Skip, See all events or a tap outside the buttons shows the
 * app at any time; a swipe sideways moves between events. With more than one they run past
 * 5 seconds, so Pause holds them (WCAG 2.2.2). Register opens the event's page and holds them.
 */
export function Stories({
  stories,
  logo,
  defaultPicture = logo,
  onClose,
}: {
  stories: Story[];
  /** The center's round logo, top left. */
  logo: string;
  /** The center's logo, large: the picture of an event that has none, or whose didn't load. */
  defaultPicture?: string;
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const story = stories[at];

  useEffect(() => {
    box.current?.focus();
  }, []);

  // Each event shows for 5 seconds; a swipe to another starts its 5 seconds again.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => {
      if (at + 1 >= stories.length) onClose();
      else setAt(at + 1);
    }, STORY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [at, paused, stories.length, onClose]);

  const move = (step: number) => {
    const next = at + step;
    if (next >= stories.length) onClose();
    else setAt(Math.max(0, next));
  };

  if (!story) return null;
  const many = stories.length > 1;
  return (
    <div
      ref={box}
      className="ui-stories"
      role="dialog"
      aria-modal="true"
      aria-label="Featured events"
      tabIndex={-1}
      onClick={(e) => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        // A tap anywhere but a button or link shows the app.
        if (!(e.target as Element).closest("a, button")) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(t.clientY - start.y)) return;
        swiped.current = true;
        move(dx < 0 ? 1 : -1);
      }}
    >
      <div className="ui-poster-media">
        {/* Every event's picture from the start, one over the other: the next has loaded when
            its turn comes, and only the picture changes. */}
        {stories.map((s, i) => (
          <div key={s.id} className="ui-poster-art" data-on={i === at || undefined}>
            {s.picture && !missing.has(s.id) ? (
              <>
                <img className="ui-poster-blur" src={s.picture} alt="" />
                <img
                  className="ui-poster-pic"
                  src={s.picture}
                  alt=""
                  onError={() => {
                    setMissing((ids) => new Set(ids).add(s.id));
                  }}
                />
              </>
            ) : (
              // No picture, or it didn't load: the center's logo.
              <img className="ui-poster-default" src={defaultPicture} alt="" />
            )}
          </div>
        ))}
        <div className="ui-poster-top">
          <img className="ui-poster-logo" src={logo} alt="" />
          <button type="button" className="ui-poster-skip" onClick={onClose}>
            Skip
          </button>
        </div>
      </div>
      <div className="ui-poster-body">
        {/* Every event's words share one space, as tall as the longest, so the dots and the
            buttons under it never move. */}
        <div className="ui-poster-texts" aria-live="polite">
          {stories.map((s, i) => (
            <div
              key={s.id}
              className="ui-poster-text"
              data-on={i === at || undefined}
              aria-hidden={i !== at || undefined}
            >
              {s.tag && (
                <span
                  className="ui-tag"
                  data-kind={s.kind ?? undefined}
                  data-tone={s.tone ?? undefined}
                >
                  {s.tag}
                </span>
              )}
              <h2 className="ui-poster-title">{s.title}</h2>
              <p className="ui-poster-when">{s.when}</p>
              <p className="ui-poster-where">{s.where}</p>
            </div>
          ))}
        </div>
        {many && (
          <div className="ui-poster-pager">
            <span className="ui-sr">
              {at + 1} of {stories.length}
            </span>
            <span className="ui-poster-dots" aria-hidden="true">
              {stories.map((s, i) => (
                <i key={s.id} data-on={i === at || undefined} />
              ))}
            </span>
            <button
              type="button"
              className="ui-poster-pause"
              aria-label={paused ? "Play" : "Pause"}
              onClick={() => {
                setPaused(!paused);
              }}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
        )}
        <a
          className="ui-poster-register"
          href={story.link.href}
          target="_blank"
          rel="noopener"
          onClick={() => {
            setPaused(true);
          }}
        >
          {story.link.label}
        </a>
        <button type="button" className="ui-poster-all" onClick={onClose}>
          See all events
        </button>
      </div>
    </div>
  );
}
