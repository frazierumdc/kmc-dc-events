import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EventSheet } from "./EventSheet.tsx";
import { Sheet } from "../shared/Sheet.tsx";
import { APPLE, GOOGLE, APPLE_MAPS, GOOGLE_MAPS, noop } from "../../test/support.tsx";

afterEach(cleanup);

function dragPanel(): { panel: HTMLElement; close: ReturnType<typeof vi.fn> } {
  const close = vi.fn();
  render(
    <Sheet open onClose={close} labelledBy="t">
      <div className="ui-sheet-head">
        <span className="ui-grabber" />
      </div>
      <div className="ui-sheet-body">
        <h2 id="t" tabIndex={-1}>
          Monday Meditation Class
        </h2>
      </div>
    </Sheet>,
  );
  const panel = screen.getByRole("dialog").firstElementChild as HTMLElement;
  Object.defineProperty(panel, "offsetHeight", { value: 600 });
  return { panel, close };
}

function drag(on: Element, from: number, to: number) {
  fireEvent.touchStart(on, { touches: [{ clientX: 100, clientY: from }] });
  for (const y of [from + Math.sign(to - from) * 10, to])
    fireEvent.touchMove(on, { touches: [{ clientX: 100, clientY: y }] });
  fireEvent.touchEnd(on, { touches: [] });
}

test("dragging the panel down far enough closes it; a short drag springs back (EV-36)", () => {
  const { panel, close } = dragPanel();
  const grabber = panel.querySelector(".ui-grabber") as Element;
  drag(grabber, 100, 115);
  expect(close).not.toHaveBeenCalled();
  expect(panel.style.transform).toBe("");
  drag(grabber, 100, 300);
  expect(close).toHaveBeenCalledOnce();
  expect(panel.style.getPropertyValue("--sheet-from")).toBe("200.0px");
});

test("a drag down in a scrolled panel scrolls it, and a drag up never closes (EV-36)", () => {
  const { panel, close } = dragPanel();
  const title = screen.getByRole("heading");
  drag(title, 300, 100);
  expect(close).not.toHaveBeenCalled();
  panel.scrollTop = 120;
  drag(title, 100, 300);
  expect(close).not.toHaveBeenCalled();
  // From the top it closes however far the text is scrolled.
  drag(panel.querySelector(".ui-grabber") as Element, 100, 300);
  expect(close).toHaveBeenCalledOnce();
});

test("the panel as the mock-ups: a tinted pill, then Register, Add to calendar and Share, Directions (D45)", () => {
  const actions = {
    main: { label: "Register", href: "https://www.example.org/event-details/x" },
    online: null,
    calendar: { label: "Add to calendar", choices: [APPLE, GOOGLE] },
    directions: { label: "Directions", choices: [APPLE_MAPS, GOOGLE_MAPS] },
    share: { url: "https://example.org/e/x" },
  };
  const sheet = (kind: "class" | null, categories: string | null) =>
    render(
      <EventSheet
        titleId="t"
        categories={categories}
        kind={kind}
        title="Monday Meditation Class"
        when={["Monday, October 12, 2026", "7:00 PM to 8:15 PM Eastern"]}
        where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
        description={null}
        actions={actions}
        onClose={() => undefined}
      />,
    );
  sheet("class", "Weekly Meditation Classes");
  expect(document.querySelector(".ui-tag")?.getAttribute("data-kind")).toBe("class");
  expect(
    [...document.querySelectorAll(".ui-actions .ui-btn")].map((b) => [b.textContent, b.className]),
  ).toEqual([
    ["Register", "ui-btn ui-btn-main"],
    ["Add to calendar", "ui-btn"],
    ["Share", "ui-btn"],
    ["Directions", "ui-btn ui-btn-outline"],
  ]);
  cleanup();
  // No kind: a grey pill; no categories: no pill, ✕ stays on the right.
  sheet(null, "Members Only");
  expect(document.querySelector(".ui-tag")?.hasAttribute("data-kind")).toBe(false);
  cleanup();
  sheet(null, null);
  expect(document.querySelector(".ui-tag")).toBeNull();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
});

test("Share hands the menu the event's link alone, as text, so it arrives as one link preview (EV-35)", async () => {
  const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
  Object.assign(navigator, { share });
  try {
    render(
      <EventSheet
        titleId="t"
        categories={null}
        kind="class"
        title="Monday Meditation Class"
        when={["Monday, October 12, 2026", "7:00 PM to 8:15 PM Eastern"]}
        where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
        description={null}
        actions={{
          main: { label: "Register", href: "https://www.example.org/event-details/x" },
          online: null,
          calendar: { label: "Add to calendar", choices: [GOOGLE] },
          directions: null,
          share: { url: "https://example.org/e/x" },
        }}
        onClose={() => undefined}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
      await Promise.resolve();
    });
    expect(share).toHaveBeenCalledWith({ text: "https://example.org/e/x" });
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});

test("the online button: outlined with a screen, after the main button, its line read with it (D46)", () => {
  render(
    <EventSheet
      titleId="t"
      categories="Weekly Meditation Classes"
      kind="class"
      title="Wednesday Step by Step Meditation"
      when={["Wednesday, October 14, 2026", "7:00 PM to 8:00 PM Eastern"]}
      where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
      description={null}
      actions={{
        main: {
          label: "Register in person",
          href: "https://www.example.org/event-details/x",
        },
        online: {
          label: "Join online",
          href: "https://www.example.org/online-classes",
          caption: "Log in on the website to get the livestream link",
        },
        calendar: { label: "Add to calendar", choices: [APPLE, GOOGLE] },
        directions: { label: "Directions", choices: [APPLE_MAPS, GOOGLE_MAPS] },
        share: { url: "https://example.org/e/x" },
      }}
      onClose={() => undefined}
    />,
  );
  expect(
    [...document.querySelectorAll(".ui-actions .ui-btn")].map((b) => [b.textContent, b.className]),
  ).toEqual([
    ["Register in person", "ui-btn ui-btn-main"],
    ["Join online", "ui-btn ui-btn-outline"],
    ["Add to calendar", "ui-btn"],
    ["Share", "ui-btn"],
    ["Directions", "ui-btn ui-btn-outline"],
  ]);
  const join = screen.getByRole("link", {
    name: "Join online",
    description: "Log in on the website to get the livestream link",
  });
  expect(join.getAttribute("href")).toBe("https://www.example.org/online-classes");
  expect(join.getAttribute("target")).toBe("_blank");
  expect(join.querySelector("svg")).not.toBeNull();
});

// ---- "Schedule updated" (EV-19) ----

// Notify me (NT-13, NT-48): a labelled switch above the panel's buttons, saying what
// following means; none where notifications can't be on.
function panelFollowing(follow: Parameters<typeof EventSheet>[0]["follow"]) {
  render(
    <EventSheet
      titleId="t"
      categories="Weekly Meditation Classes"
      kind="class"
      title="Wednesday Step by Step Meditation"
      when={["Wednesday, November 11, 2026", "7:00 PM to 8:00 PM Eastern"]}
      where={{ online: false, lines: ["Kadampa Meditation Center DC"] }}
      description={null}
      actions={{
        main: {
          label: "Register in person",
          href: "https://www.example.org/event-details/x",
        },
        online: null,
        calendar: { label: "Add to calendar", choices: [APPLE, GOOGLE] },
        directions: null,
        share: { url: "https://example.org/e/x" },
      }}
      follow={follow}
      onClose={noop}
    />,
  );
}

test("Notify me: a switch above the buttons, saying what it sends (NT-13, NT-48)", () => {
  const changes: boolean[] = [];
  panelFollowing({
    on: false,
    detail: "A reminder the day before each class, and if one changes",
    busy: false,
    onChange: (on) => changes.push(on),
  });
  const toggle = screen.getByRole("switch", { name: "Notify me" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(document.getElementById(toggle.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
    "A reminder the day before each class, and if one changes",
  );
  const order = [...document.querySelectorAll(".ui-follow, .ui-actions")].map((e) => e.className);
  expect(order).toEqual(["ui-follow", "ui-actions"]);
  fireEvent.click(toggle);
  expect(changes).toEqual([true]);
});

test("no Notify me where notifications can't be on", () => {
  panelFollowing(null);
  expect(screen.queryByRole("switch")).toBeNull();
});
