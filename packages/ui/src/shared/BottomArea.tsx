import { useEffect, useRef, type ReactNode } from "react";

/**
 * The bottom of the screen, above the home indicator: the messages (EV-19, EV-21) float
 * here over the list. Its height, larger text included, is kept in `--bottom-h` so the list
 * can always scroll clear of it (EV-17). Empty, it takes no taps.
 */
export function BottomArea({ children }: { children?: ReactNode }) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bottom.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--bottom-h", `${String(el.offsetHeight)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="ui-bottom" ref={bottom}>
      {children}
    </div>
  );
}
