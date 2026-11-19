import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** One step of the player: its short sentence and the picture of what Safari shows then. */
export interface PlayStep {
  key: string;
  text: ReactNode;
  picture: ReactNode;
}

/** How long a step stays, and the width the pictures are drawn at. */
const HOLD = 4300;
const PICTURE = 291;
/** The scene's height; pictures taller than their window are moved to keep the button in view. */
const SCENE = 138;
const EASE = "cubic-bezier(.2,.8,.2,1)";

/**
 * Safari's five steps on one screen, playing by themselves (IN-10): the list of steps, the
 * one playing lit and filling, over one scene where each of Safari's screens arrives as
 * Safari draws it and a finger taps the button; last, the app on the Home Screen. It plays
 * twice, then rests on step 1 with Replay. Pause is in the scene's corner; a tap on the scene
 * shows the next step. With Reduce Motion nothing moves: the steps are stepped through by tapping.
 */
export function InstallPlayer({
  steps,
  icon,
  appName,
  menuFrom,
}: {
  steps: PlayStep[];
  icon: string;
  appName: string;
  /** Where the menu grows from: the side of the bar its button is on. */
  menuFrom: "left" | "right";
}) {
  const count = steps.length + 1;
  const [still] = useState(
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [at, setAt] = useState(0);
  const [on, setOn] = useState(!still);
  // It has played through: the button offers Replay, from step 1.
  const [ended, setEnded] = useState(false);
  const pass = useRef(0);
  const busy = useRef(0);
  const scene = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const fills = useRef<(HTMLElement | null)[]>([]);

  // On a phone narrower than the pictures, the whole scene's content is drawn smaller.
  useLayoutEffect(() => {
    const fit = () => {
      const host = scene.current;
      if (!host?.clientWidth) return;
      // Beside Pause (44 pt and its margins), with a little room each side.
      host.style.setProperty(
        "--play-s",
        String(Math.min(1, (host.clientWidth - 52 - 8) / PICTURE)),
      );
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
    };
  }, []);

  // The step's screen arrives, then the finger taps its button.
  useEffect(() => {
    const host = scene.current;
    const f = finger.current;
    const layer = layers.current[at];
    if (!host || !f || !layer) return;
    const ripple = f.firstElementChild as HTMLElement;
    let timer = 0;
    const moving: Animation[] = [];
    const aim = () => {
      const ring = layer.querySelector("[data-ring], .ui-pic-item, .ui-pic-add") ?? layer;
      const a = ring.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
    };
    const place = (x: number, y: number, s = 1) => `translate(${x - 17}px,${y - 17}px) scale(${s})`;
    if (at === steps.length) {
      f.style.opacity = "0";
      busy.current = 1200;
    } else if (still) {
      const t = aim();
      f.style.opacity = "1";
      f.style.transform = place(t.x, t.y);
      busy.current = 0;
    } else {
      // Aimed once the screen has arrived, at where its button really is.
      f.style.opacity = "0";
      const wait = 560;
      busy.current = wait + 1900;
      timer = window.setTimeout(() => {
        const t = aim();
        const sx = host.clientWidth * 0.78;
        const sy = host.clientHeight + 20;
        moving.push(
          f.animate(
            [
              { transform: place(sx, sy), opacity: 0, offset: 0 },
              { transform: place(sx, sy - 30), opacity: 1, offset: 0.15 },
              { transform: place(t.x, t.y), opacity: 1, offset: 0.55, easing: "ease-in" },
              { transform: place(t.x, t.y, 0.78), opacity: 1, offset: 0.65 },
              { transform: place(t.x, t.y), opacity: 1, offset: 0.75 },
              { transform: place(t.x, t.y), opacity: 1, offset: 0.92 },
              { transform: place(t.x, t.y), opacity: 0, offset: 1 },
            ],
            { duration: 1900, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" },
          ),
          ripple.animate(
            [
              { transform: "scale(.6)", opacity: 0, offset: 0 },
              { transform: "scale(.6)", opacity: 0.9, offset: 0.62 },
              { transform: "scale(2.4)", opacity: 0, offset: 0.9 },
              { transform: "scale(2.4)", opacity: 0, offset: 1 },
            ],
            { duration: 1900, fill: "both" },
          ),
        );
      }, wait);
    }
    if (!still) {
      // As Safari draws each: the bar is there, the menu grows from its button, the sheets
      // slide up, the Home Screen settles.
      const origin = `${menuFrom === "left" ? "18%" : "82%"} 100%`;
      const arrive: Keyframe[][] = [
        [{ opacity: 0 }, { opacity: 1 }],
        [
          { opacity: 0, transform: "scale(.3)", transformOrigin: origin },
          { opacity: 1, transform: "none", transformOrigin: origin },
        ],
        [{ transform: "translateY(100%)" }, { transform: "none" }],
        [
          { transform: "translateY(45%)", opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        [{ transform: "translateY(100%)" }, { transform: "none" }],
        [
          { opacity: 0, transform: "scale(1.25)" },
          { opacity: 1, transform: "none" },
        ],
      ];
      moving.push(
        layer.animate(arrive[Math.min(at, arrive.length - 1)] ?? [], {
          duration: at === 1 ? 380 : 460,
          easing: EASE,
        }),
      );
    }
    return () => {
      window.clearTimeout(timer);
      for (const m of moving) m.cancel();
    };
  }, [at, still, steps.length, menuFrom]);

  // The line under the step playing fills while it stays; then the next step, twice round.
  useEffect(() => {
    const fill = fills.current[at];
    if (!on) {
      if (!still) for (const a of fill?.getAnimations() ?? []) a.pause();
      return;
    }
    const filling = fill?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: HOLD,
      fill: "forwards",
    });
    const timer = window.setTimeout(
      () => {
        if (at === count - 1 && ++pass.current >= 2) {
          setOn(false);
          setEnded(true);
          setAt(0);
        } else setAt((at + 1) % count);
      },
      Math.max(HOLD, busy.current + 1400),
    );
    return () => {
      window.clearTimeout(timer);
      filling?.cancel();
    };
  }, [at, on, count, still]);

  // Stopped at the end (played through, or on the Home Screen): Replay starts again at step 1.
  const replay = !on && (ended || at === steps.length);

  return (
    <div className="ui-play">
      <ol className="ui-play-list" role="list">
        {steps.map((step, i) => (
          <li key={step.key} className="ui-play-row" aria-current={i === at ? "step" : undefined}>
            <span className="ui-step-n">{i + 1}</span>
            <span className="ui-play-text">{step.text}</span>
            <i
              className="ui-play-fill"
              ref={(e) => {
                fills.current[i] = e;
              }}
            />
          </li>
        ))}
      </ol>
      <div className="ui-play-scene" ref={scene} style={{ height: SCENE }}>
        <div className="ui-play-page" aria-hidden="true">
          <b />
          <i />
          <i data-short />
          <i />
          <i data-short />
        </div>
        <div className="ui-play-scrim" data-on={(at >= 2 && at < steps.length) || undefined} />
        {steps.map((step, i) => (
          <div
            key={step.key}
            className="ui-play-layer"
            data-layer={i}
            // The bar stays under its menu, and the list under the Add screen, as in Safari.
            data-on={i === at || (i === 0 && at === 1) || (i === 3 && at === 4) || undefined}
            ref={(e) => {
              layers.current[i] = e;
            }}
          >
            <PictureWindow
              height={i === 0 ? 46 : i === 1 || i === 4 ? SCENE - 8 : SCENE - 4}
              shrink={i === 1 || i === 4}
            >
              {step.picture}
            </PictureWindow>
          </div>
        ))}
        <div
          className="ui-play-layer ui-play-home"
          data-on={at === steps.length || undefined}
          aria-hidden="true"
          ref={(e) => {
            layers.current[steps.length] = e;
          }}
        >
          <div className="ui-play-apps">
            {Array.from({ length: 7 }, (_, k) => (
              <i key={k} />
            ))}
            <span className="ui-play-app">
              <img src={icon} alt="" />
              <b>{appName}</b>
            </span>
          </div>
        </div>
        <div className="ui-play-finger" ref={finger} aria-hidden="true">
          <div className="ui-play-ripple" />
        </div>
        <button
          type="button"
          className="ui-play-next"
          aria-label="Next step"
          onClick={() => {
            setOn(false);
            setEnded(false);
            setAt((at + 1) % count);
          }}
        />
        {!still && (
          <button
            type="button"
            className="ui-play-pause"
            data-replay={replay || undefined}
            onClick={() => {
              pass.current = 0;
              setEnded(false);
              if (replay) setAt(0);
              setOn(!on);
            }}
          >
            {replay ? (
              <>
                <span aria-hidden="true">↻</span> Replay
              </>
            ) : (
              <span role="img" aria-label={on ? "Pause" : "Play"}>
                {on ? "❚❚" : "▶"}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A picture in a window: whole where it fits (made smaller when `shrink`), else moved so the
 * ringed button stays in view, its cut edge faded.
 */
function PictureWindow({
  height,
  shrink,
  children,
}: {
  height: number;
  shrink: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const raw = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current;
      const r = raw.current;
      if (!w || !r) return;
      r.style.transform = "none";
      const size = { width: r.offsetWidth, height: r.offsetHeight };
      if (!size.width || !size.height) return;
      const ring = r.querySelector<HTMLElement>("[data-ring], .ui-pic-item, .ui-pic-add");
      const a = ring?.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      // The window may be drawn smaller (a narrow phone): measure in the picture's own units.
      const drawn = b.width / size.width || 1;
      const s = shrink ? Math.min(1, height / size.height) : 1;
      const tx = a ? ((a.left - b.left + a.width / 2) / drawn) * s : (size.width * s) / 2;
      const ty = a ? ((a.top - b.top + a.height / 2) / drawn) * s : (size.height * s) / 2;
      const pos = (length: number, room: number, t: number) =>
        length <= room ? (room - length) / 2 : Math.max(room - length, Math.min(0, room / 2 - t));
      const y = pos(size.height * s, height, ty);
      r.style.transform = `translate(${pos(size.width * s, PICTURE, tx)}px,${y}px) scale(${s})`;
      const over = size.height * s - height;
      if (over > 1) w.dataset.cut = y < -1 && y > -over + 1 ? "both" : y < -1 ? "top" : "bottom";
      else delete w.dataset.cut;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
    };
  }, [height, shrink]);
  return (
    <div className="ui-play-window" ref={box} style={{ width: PICTURE, height }}>
      <div className="ui-play-raw" ref={raw}>
        {children}
      </div>
    </div>
  );
}
