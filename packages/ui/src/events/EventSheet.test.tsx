import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EventSheet } from "./EventSheet.tsx";
import { Sheet } from "../shared/Sheet.tsx";
import { APPLE, GOOGLE, APPLE_MAPS, GOOGLE_MAPS } from "../../test/support.tsx";

afterEach(cleanup);

test("addresses in the panel's description can be tapped: web ones open outside the app (EV-33)", () => {
  render(
    <EventSheet
      titleId="t"
      categories="Chanted Prayers"
      kind="prayer"
      title="Heart Jewel Prayers & Silent Meditation"
      when={["Wednesday, October 21, 2026", "8:00 AM to 9:00 AM Eastern"]}
      where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
      description={
        "In the book Heart Jewel (https://tharpa.com/us/heart-jewel-393.html).\n\nAsk office@example.org"
      }
      actions={{
        main: { label: "More info", href: "https://www.example.org/event-details/x" },
        online: null,
        calendar: { label: "Add to calendar", choices: [APPLE, GOOGLE] },
        directions: null,
        share: { url: "https://example.org/e/x" },
      }}
      onClose={() => undefined}
    />,
  );
  const desc = document.querySelector<HTMLElement>(".ui-desc");
  if (desc === null) throw new Error("no description");
  expect(desc.textContent).toBe(
    "In the book Heart Jewel (https://tharpa.com/us/heart-jewel-393.html).\n\nAsk office@example.org",
  );
  const links = within(desc).getAllByRole("link");
  expect(
    links.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target")]),
  ).toEqual([
    [
      "https://tharpa.com/us/heart-jewel-393.html",
      "https://tharpa.com/us/heart-jewel-393.html",
      "_blank",
    ],
    ["office@example.org", "mailto:office@example.org", null],
  ]);
});

function panelWith(choices: (typeof APPLE)[]) {
  render(
    <EventSheet
      titleId="t"
      categories={null}
      kind={null}
      title="Monday Meditation Class"
      when={["Monday, October 12, 2026", "7:00 PM to 8:15 PM Eastern"]}
      where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
      description={null}
      actions={{
        main: { label: "Register", href: "https://www.example.org/event-details/x" },
        online: null,
        calendar: { label: "Add to calendar", choices },
        directions: null,
        share: { url: "https://example.org/e/x" },
      }}
      onClose={() => undefined}
    />,
  );
}

test("Add to calendar with one place goes straight there (Android, EV-35)", () => {
  panelWith([GOOGLE]);
  const link = screen.getByRole("link", { name: "Add to calendar" });
  expect(link.getAttribute("href")).toBe(GOOGLE.href);
  expect(link.getAttribute("target")).toBe("_blank");
});

test("Add to calendar on iPhone: Apple or Google Calendar in an action sheet (EV-35)", () => {
  vi.useFakeTimers();
  panelWith([APPLE, GOOGLE]);
  const button = screen.getByRole("button", { name: "Add to calendar" });
  expect(button.getAttribute("aria-haspopup")).toBe("dialog");
  fireEvent.click(button);
  const sheet = screen.getByRole("dialog", { name: "Add to calendar" });
  const apple = within(sheet).getByRole("link", { name: "Apple Calendar" });
  // The calendar file opens in the app's own window, where iPhone offers to add it.
  expect(apple.getAttribute("href")).toBe(APPLE.href);
  expect(apple.hasAttribute("target")).toBe(false);
  expect(within(sheet).getByRole("link", { name: "Google Calendar" }).getAttribute("target")).toBe(
    "_blank",
  );
  // Cancel closes it, and focus goes back to the button.
  fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
  // A choice closes it once the link has been followed.
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("link", { name: "Apple Calendar" }));
  act(() => {
    vi.runAllTimers();
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  vi.useRealTimers();
});

function panelWithDirections(choices: (typeof APPLE_MAPS)[]) {
  render(
    <EventSheet
      titleId="t"
      categories={null}
      kind={null}
      title="Monday Meditation Class"
      when={["Monday, October 12, 2026", "7:00 PM to 8:15 PM Eastern"]}
      where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
      description={null}
      actions={{
        main: { label: "Register", href: "https://www.example.org/event-details/x" },
        online: null,
        calendar: { label: "Add to calendar", choices: [GOOGLE] },
        directions: { label: "Directions", choices },
        share: { url: "https://example.org/e/x" },
      }}
      onClose={() => undefined}
    />,
  );
}

test("Directions with one place goes straight to Google Maps (Android, EV-35)", () => {
  panelWithDirections([GOOGLE_MAPS]);
  const link = screen.getByRole("link", { name: "Directions" });
  expect(link.getAttribute("href")).toBe(GOOGLE_MAPS.href);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.className).toBe("ui-btn ui-btn-outline");
});

test("Directions on iPhone: Apple Maps, then Google Maps, in an action sheet (EV-35)", () => {
  panelWithDirections([APPLE_MAPS, GOOGLE_MAPS]);
  const button = screen.getByRole("button", { name: "Directions" });
  expect(button.className).toBe("ui-btn ui-btn-outline");
  fireEvent.click(button);
  const sheet = screen.getByRole("dialog", { name: "Directions" });
  const links = within(sheet).getAllByRole("link");
  expect(
    links.map((l) => [l.textContent, l.getAttribute("href"), l.getAttribute("target")]),
  ).toEqual([
    ["Apple Maps", APPLE_MAPS.href, "_blank"],
    ["Google Maps", GOOGLE_MAPS.href, "_blank"],
  ]);
  fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
});

test("Escape or the browser closing the action sheet leaves the details panel open", () => {
  const closePanel = vi.fn();
  render(
    <Sheet open onClose={closePanel} labelledBy="t">
      <EventSheet
        titleId="t"
        categories={null}
        kind={null}
        title="Monday Meditation Class"
        when={["Monday, October 12, 2026", "7:00 PM to 8:15 PM Eastern"]}
        where={{ online: false, lines: [] }}
        description={null}
        actions={{
          main: { label: "Register", href: "https://www.example.org/event-details/x" },
          online: null,
          calendar: { label: "Add to calendar", choices: [APPLE, GOOGLE] },
          directions: null,
          share: { url: "https://example.org/e/x" },
        }}
        onClose={closePanel}
      />
    </Sheet>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add to calendar" }));
  const choices = screen.getByRole("dialog", { name: "Add to calendar" });
  fireEvent(choices, new Event("close"));
  expect(closePanel).not.toHaveBeenCalled();
  fireEvent(choices, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog", { name: "Add to calendar" })).toBeNull();
  expect(closePanel).not.toHaveBeenCalled();
});
