import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapshotV2 } from "@kmcdc/domain";
import type { Story } from "@kmcdc/ui";
import { featuredStories } from "../events/stories.ts";
import type { Splash } from "./splash.ts";

/**
 * Featured events (EV-44): when the splash shows and there are some, they follow it, on
 * opening and after 5 minutes or more away. `stories` is what to show; null for nothing.
 */
export function useFeaturedStories(
  splash: Pick<Splash, "covering" | "onCover" | "handOff"> | undefined,
  /** The schedule has loaded, or failed to. */
  settled: boolean,
  snapshot: SnapshotV2 | null,
  now: () => Date,
): { stories: Story[] | null; closeStories: () => void } {
  const [stories, setStories] = useState<Story[] | null>(null);
  // The clock the splash's callbacks read is the latest one given.
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  });
  useEffect(() => {
    if (!splash || !settled) return;
    const cover = () => {
      const found = featuredStories(snapshot, nowRef.current());
      if (found.length === 0) return false;
      // Their pictures load behind the splash, so the first poster shows whole at once.
      for (const story of found) if (story.picture) new Image().src = story.picture;
      // The splash stays its 3 seconds, then the featured events follow it.
      splash.handOff(() => {
        setStories(found);
      });
      return true;
    };
    if (splash.covering()) cover();
    return splash.onCover(() => {
      cover();
    });
  }, [splash, settled, snapshot]);
  const closeStories = useCallback(() => {
    setStories(null);
  }, []);
  return { stories, closeStories };
}
