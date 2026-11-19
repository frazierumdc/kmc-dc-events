import { formatEasternDateTime } from "@kmcdc/domain";
import { SettingsSheet, Sheet, type NotificationsProps } from "@kmcdc/ui";
import appIcon from "../../../../brand/images/apple-touch-icon-180x180.png";
import type { Schedule } from "../schedule/schedule.ts";
import type { SettingsState } from "./use-settings.ts";

/**
 * The Settings sheet (EV-41, NT-30): when the schedule was updated, how to add the app to
 * the home screen, notifications and the version.
 */
export function SettingsPanel({
  settings,
  schedule,
  notifications,
}: {
  settings: SettingsState;
  /** Null before the schedule has loaded. */
  schedule: Schedule | null;
  notifications: NotificationsProps | null;
}) {
  return (
    <Sheet
      open={settings.open}
      onClose={settings.close}
      onClosed={settings.closed}
      labelledBy="settings-title"
    >
      <SettingsSheet
        titleId="settings-title"
        icon={appIcon}
        updated={
          schedule
            ? `Schedule updated ${formatEasternDateTime(schedule.manifest.publishedAt)}`
            : null
        }
        version={__BUILD_ID__}
        guide={settings.guide}
        addLink={`${window.location.origin}/get-app`}
        notifications={notifications}
        onClose={settings.close}
      />
    </Sheet>
  );
}
