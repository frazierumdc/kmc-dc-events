import { useCallback, useRef, useState, type RefObject } from "react";
import type { SwipeTabsHandle } from "@kmcdc/ui";
import { ALL, KIND_FILTERS, type KindFilter } from "./days.ts";
import { readKindFilter, saveKindFilter } from "./kind-filter-store.ts";

export interface KindFilterState {
  filter: KindFilter;
  /** The filter's place among the choices. */
  position: number;
  /** Swiping the list moves along the filter's choices (EV-12). */
  swipe: (step: 1 | -1) => void;
  /** A tapped filter slides the list toward it, as a swipe does (EV-12). */
  tap: (value: KindFilter) => void;
  /** For the list's SwipeTabs, which `tap` slides. */
  tabs: RefObject<SwipeTabsHandle | null>;
}

/**
 * The kind filter (EV-12), remembered between visits. Opened by a notification (NT-15,
 * `arrival` is its date), the list is under All for this visit, so the event is listed
 * whatever filter is remembered.
 */
export function useKindFilter(arrival: string | null): KindFilterState {
  const [filter, setFilter] = useState<KindFilter>(() =>
    arrival === null ? readKindFilter() : ALL,
  );

  const choose = useCallback((value: KindFilter) => {
    setFilter(value);
    saveKindFilter(value);
  }, []);
  const position = KIND_FILTERS.findIndex((f) => f.value === filter);
  const swipe = useCallback(
    (step: 1 | -1) => {
      const next = KIND_FILTERS[position + step];
      if (next) choose(next.value);
    },
    [position, choose],
  );
  const tabs = useRef<SwipeTabsHandle>(null);
  const tap = useCallback(
    (value: KindFilter) => {
      const to = KIND_FILTERS.findIndex((f) => f.value === value);
      if (to === position) return;
      if (tabs.current) {
        tabs.current.slide(to > position ? 1 : -1, () => {
          choose(value);
        });
      } else choose(value);
    },
    [position, choose],
  );
  return { filter, position, swipe, tap, tabs };
}
