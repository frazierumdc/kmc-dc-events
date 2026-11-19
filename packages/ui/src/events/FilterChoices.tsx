import { useState, type CSSProperties } from "react";

export interface FilterChoicesProps<T extends string> {
  /** `dot` shows a dot of that kind's colour before the label, so the filter is the key. */
  options: readonly { value: T; label: string; dot?: "class" | "special" | "prayer" }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * One choice always selected (EV-12): a capsule segmented control on iPhone, connected
 * buttons on Android, each 44 pt or 48 dp tall (option A, owner, 13 November 2026). A kind's
 * choice has a dot of its colour (D45). Each button says whether it's selected (NFR-2), and
 * its name is semibold. On iPhone one thumb (white, a lighter grey in dark) slides to the
 * selected segment and follows a swipe of the list (`--swipe`); on Android the selected
 * button is tinted maroon, and the one a swipe would choose is tinted as soon as letting go
 * would choose it (`data-rel`, `data-swipe-to`). A tapped choice shows as selected at once,
 * while the list is still sliding to it.
 */
export function FilterChoices<T extends string>({
  options,
  value,
  onChange,
}: FilterChoicesProps<T>) {
  // The choice tapped, until `value` catches up.
  const [picked, setPicked] = useState<T | null>(null);
  if (picked !== null && picked === value) setPicked(null);
  const selected = picked ?? value;
  const at = options.findIndex((option) => option.value === selected);
  return (
    <div
      className="ui-filter"
      role="group"
      aria-label="Show"
      style={{ "--n": options.length, "--at": at } as CSSProperties}
    >
      <span className="ui-thumb" aria-hidden="true" />
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === selected}
          data-rel={i === at + 1 ? "next" : i === at - 1 ? "prev" : undefined}
          onClick={() => {
            if (option.value === selected) return;
            setPicked(option.value);
            onChange(option.value);
          }}
        >
          {option.dot && <span className="ui-kinddot" data-kind={option.dot} aria-hidden="true" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
