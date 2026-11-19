import { render } from "@testing-library/react";
import { SettingsSheet, type SettingsSheetProps } from "../src/app-shell/SettingsSheet.tsx";
import type { NotificationsProps } from "../src/notifications/NotificationsScreen.tsx";

// Shared by the tests split from SettingsSheet.test.tsx.

export const sheet = (props: Partial<SettingsSheetProps> = {}) => (
  <div role="dialog" aria-labelledby="t">
    <SettingsSheet
      titleId="t"
      icon="/icon.png"
      updated="Schedule updated October 26, 2026, 4:09 AM"
      version="20261026-abc1234"
      guide="ios27"
      addLink="https://example.web.app/get-app"
      notifications={null}
      onClose={() => {}}
      {...props}
    />
  </div>
);

export function info(props: Partial<SettingsSheetProps> = {}) {
  return render(sheet(props));
}

export function notifications(over: Partial<NotificationsProps> = {}): NotificationsProps {
  return {
    state: "off",
    busy: false,
    failed: false,
    android: false,
    addLink: "https://example.web.app/get-app",
    choices: [],
    onFollow: () => {},
    onTurnOn: () => {},
    onTurnOff: () => {},
    ...over,
  };
}
