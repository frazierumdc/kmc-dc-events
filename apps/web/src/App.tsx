import { memo, useEffect, useRef, useState } from "react";
import { easternDate } from "@kmcdc/domain";
import { BottomArea, FilterChoices, Header, SettingsIcon, Stories, SwipeTabs } from "@kmcdc/ui";
import logo1x from "../../../brand/images/header-logo.png";
import logo2x from "../../../brand/images/header-logo@2x.png";
import logo3x from "../../../brand/images/header-logo@3x.png";
import logoLarge from "../../../brand/images/splash-logo.png";
import { SettingsPanel } from "./app-shell/SettingsPanel.tsx";
import type { Splash } from "./app-shell/splash.ts";
import { useFeaturedStories } from "./app-shell/use-featured-stories.ts";
import { useSettings } from "./app-shell/use-settings.ts";
import { takeArrivalDay } from "./events/day-route.ts";
import { KIND_FILTERS } from "./events/days.ts";
import { EventList } from "./events/EventList.tsx";
import { EventPanel } from "./events/EventPanel.tsx";
import { FollowingStrip } from "./events/FollowingStrip.tsx";
import { ScheduleMain } from "./events/ScheduleMain.tsx";
import { useEventPanel } from "./events/use-event-panel.ts";
import { useKindFilter } from "./events/use-kind-filter.ts";
import { useListedDays } from "./events/use-listed-days.ts";
import { useFollows } from "./notifications/use-follows.ts";
import { useSchedule, type ScheduleSync } from "./schedule/use-schedule.ts";

// The Events screen (slice 1.2): header with the kind filter and the row of dates, the list
// by day and the footer. A newer schedule is applied at once and silently, and the list
// keeps the day at the top (EV-19); a new version of the app says nothing (EV-21). The
// splash covers opening (EV-42): the app tells it when the schedule shows. The row of
// dates follows the list, and
// tapping a date moves the list to it (EV-14). Tapping a row opens the event's details
// panel at its own address (slice 1.3, EV-36, EV-37). Settings (a gear) in the top bar opens
// the Settings sheet: when the schedule was updated, how to add the app to the home screen,
// and the version (EV-41, NT-30).
//
// This file composes the screen. Each feature keeps its own state in a hook: the schedule
// (schedule/), the filter, the listed days and the details panel (events/), notifications
// (notifications/), Settings and the featured events after the splash (app-shell/).

// Opening or closing the details panel draws only the panel: the list and the row of dates
// are drawn again only when what they show changes, so the panel starts to slide at once.
// Scrolling redraws only the row of dates.
const List = memo(EventList);
const Strip = memo(FollowingStrip);

const LOGO = { src: logo1x, srcSet: `${logo1x} 1x, ${logo2x} 2x, ${logo3x} 3x` };
const CENTER_NAME = "Kadampa Meditation Center DC";

export interface AppProps {
  /** Where the schedule comes from and is kept; tests pass fakes. */
  sync?: ScheduleSync;
  now?: () => Date;
  /** Called once the schedule shows, or failed to load: the splash may go (EV-42). */
  onReady?: () => void;
  /** The splash, which featured events' stories take the place of (EV-44). */
  splash?: Pick<Splash, "covering" | "onCover" | "handOff">;
}

export function App({ sync, now = () => new Date(), onReady, splash }: AppProps) {
  const { state, retry, staleSince } = useSchedule(sync);
  const settled = state.status !== "loading";
  const schedule = state.status === "ready" ? state.schedule : null;
  const snapshot = schedule ? schedule.snapshot : null;
  const { stories, closeStories } = useFeaturedStories(splash, settled, snapshot, now);
  useEffect(() => {
    if (settled) onReady?.();
  }, [settled, onReady]);
  // Opened by a notification (NT-15): the list at the event's date.
  const [arrival] = useState(() => takeArrivalDay());
  const { filter, position, swipe, tap, tabs } = useKindFilter(arrival);
  const at = now();
  const today = easternDate(at);
  const { days, listed, listedDates, strip } = useListedDays(snapshot, at, filter, today);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settings = useSettings(settingsButton);
  const follows = useFollows(snapshot, settings.guide);
  const panel = useEventPanel(days);

  return (
    <>
      <Header
        logo={LOGO}
        centerName={snapshot ? snapshot.site.center.name : CENTER_NAME}
        title="Events"
        action={
          <button
            ref={settingsButton}
            type="button"
            className="ui-info-button"
            aria-label="Settings"
            aria-haspopup="dialog"
            onClick={settings.show}
          >
            <SettingsIcon />
          </button>
        }
      >
        <FilterChoices options={KIND_FILTERS} value={filter} onChange={tap} />
        {schedule && (
          <Strip
            days={strip}
            listed={listedDates}
            filter={filter}
            version={schedule.manifest.version}
            arrival={arrival}
          />
        )}
      </Header>
      <ScheduleMain state={state} retry={retry} staleSince={staleSince} today={today}>
        {schedule && (
          <SwipeTabs
            ref={tabs}
            onSwipe={swipe}
            atStart={position <= 0}
            atEnd={position >= KIND_FILTERS.length - 1}
          >
            <List schedule={schedule} days={listed} today={today} onOpen={panel.openRow} />
          </SwipeTabs>
        )}
      </ScheduleMain>
      {/* Empty: keeps the end of the list clear of the home bar. */}
      <BottomArea />
      <SettingsPanel settings={settings} schedule={schedule} notifications={follows.settings} />
      {schedule && <EventPanel panel={panel} follow={follows.followSwitch} />}
      {stories && (
        <Stories
          stories={stories}
          logo={LOGO.src}
          defaultPicture={logoLarge}
          onClose={closeStories}
        />
      )}
    </>
  );
}
