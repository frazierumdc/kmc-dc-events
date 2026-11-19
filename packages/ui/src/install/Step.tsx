import { type ReactNode } from "react";

/** A browser's button, with its icon and its own name (IN-5). */
export function Key({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <span className="ui-key" role={label ? "img" : undefined} aria-label={label}>
      {children}
    </span>
  );
}

export function Step({
  n,
  hint,
  picture,
  children,
}: {
  n: number;
  hint?: string;
  picture?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="ui-step">
      <span className="ui-step-n">{n}</span>
      <div>
        {children}
        {hint && <span className="ui-step-hint">{hint}</span>}
        {picture}
      </div>
    </li>
  );
}
