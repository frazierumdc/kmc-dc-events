import { useEffect, useRef, type ReactNode } from "react";

export interface HeaderProps {
  logo: { src: string; srcSet?: string };
  centerName: string;
  title: string;
  /** At the end of the bar: the Settings button (EV-41). */
  action?: ReactNode;
  /** The kind filter and the row of dates: they stay at the top while the list scrolls. */
  children?: ReactNode;
}

/**
 * The top of the screen (EV-22): a bar with the logo and the title in small with the
 * center's name under it in grey, as a navigation bar's title and subtitle (centred on
 * iPhone, at the start on Android), so the list keeps most of the screen and still says
 * whose events these are; Settings (a gear) at the end (EV-41); then the controls. Both stay while
 * the list scrolls.
 */
export function Header({ logo, centerName, title, action, children }: HeaderProps) {
  const bar = useRef<HTMLElement>(null);

  // The controls stick just under the bar, however tall larger text makes it.
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--topbar-h", `${String(el.offsetHeight)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <header ref={bar} className="ui-topbar">
        <div className="ui-wrap ui-topbar-row">
          <div className="ui-brand">
            <img src={logo.src} srcSet={logo.srcSet} alt="" width={36} height={36} />
          </div>
          <div className="ui-compact-title">
            <h1 className="ui-compact-main">{title}</h1>
            <span className="ui-compact-sub">{centerName}</span>
          </div>
          {action}
        </div>
      </header>
      <div className="ui-controls">
        <div className="ui-wrap">{children}</div>
      </div>
    </>
  );
}
