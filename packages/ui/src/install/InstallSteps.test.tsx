import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ChooseSafariBar } from "./ChooseSafariBar.tsx";
import type { InstallGuide } from "./guide.ts";
import { InstallSteps } from "./InstallSteps.tsx";

afterEach(cleanup);

/** The steps for one browser (Settings' own, shown on /get-app, IN-10). */
function installSteps(guide: InstallGuide, play = false) {
  const onChange = vi.fn();
  render(
    <InstallSteps
      guide={guide}
      icon="/icon.png"
      link="https://example.web.app/get-app"
      onChange={onChange}
      play={play}
    />,
  );
  return { onChange };
}

/** Each step as a screen reader gets it: the pictures are hidden from it. */
const steps = () =>
  screen.getAllByRole("listitem").map((li) => {
    const copy = li.cloneNode(true) as HTMLElement;
    for (const hidden of copy.querySelectorAll("[aria-hidden]")) hidden.remove();
    return copy.textContent;
  });

test("Safari on iOS 27: Page Menu, Share, View More, Add to Home Screen, Add (IN-3, IN-5)", () => {
  installSteps("ios27");
  expect(screen.getByText("Safari on iOS 27")).toBeTruthy();
  expect(steps()).toEqual([
    "1Tap  in the address bar.",
    "2Tap Share at the top of the menu.",
    "3Tap View More.The fourth round button, under the apps. Already see a long list? Go on to the next step.",
    "4Tap Add to Home Screen.In the list that opens. Scroll down if you don’t see it.",
    "5Leave Open as Web App on, then tap Add at the top right.",
  ]);
  expect(screen.getByRole("img", { name: "Page Menu" })).toBeTruthy();
});

test("Safari on iOS 26 starts with More at the bottom right; Share in the bar starts with Share (IN-3)", () => {
  installSteps("ios26");
  expect(steps()[0]).toBe("1Tap  at the bottom right.");
  expect(steps()).toHaveLength(5);
  expect(screen.getByRole("img", { name: "More" })).toBeTruthy();
  cleanup();
  installSteps("share-bar");
  expect(steps()).toHaveLength(4);
  expect(steps()[0]).toBe("1Tap Share in Safari’s bar.");
  expect(steps()[1]).toMatch(/^2Tap View More\./);
});

test("Not what you see? asks for the chooser, which picks Safari's bar by picture (IN-4)", () => {
  const { onChange } = installSteps("ios27");
  fireEvent.click(screen.getByRole("button", { name: "Not what you see?" }));
  expect(onChange).toHaveBeenCalled();
  cleanup();
  const onChoose = vi.fn();
  render(<ChooseSafariBar guide="ios27" onChoose={onChoose} />);
  const group = screen.getByRole("radiogroup", { name: "Safari’s bar" });
  const options = within(group).getAllByRole("radio");
  expect(options.map((o) => o.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  fireEvent.click(
    within(group).getByRole("radio", { name: "Round buttons, with More at the right" }),
  );
  expect(onChoose).toHaveBeenCalledWith("ios26");
});

test("another browser on iPhone is sent to Safari, with Copy link (IN-6)", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  installSteps("ios-other");
  expect(screen.getByText("Open this page in Safari first")).toBeTruthy();
  expect(screen.queryByRole("listitem")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByText("Link copied")).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith("https://example.web.app/get-app");
});

test("Android: Chrome's menu steps (IN-7)", () => {
  installSteps("android");
  expect(steps()).toEqual([
    "1Tap  on the right of the address bar.",
    "2Tap Install and create shortcut.",
    "3Tap Install.",
  ]);
  expect(screen.queryByRole("button", { name: "Not what you see?" })).toBeNull();
});

test("/get-app plays Safari's five steps: the same steps, said short, step 1 first (IN-10)", () => {
  installSteps("ios27", true);
  const rows = [...document.querySelectorAll(".ui-play-row")];
  expect(rows.map((row) => row.querySelector(".ui-play-text")?.textContent)).toEqual([
    "Tap .",
    "Tap Share.",
    "Tap View More.",
    "Tap Add to Home Screen.",
    "Leave Open as Web App on, then tap Add.",
  ]);
  expect(screen.getByRole("img", { name: "Page Menu" })).toBeTruthy();
  expect(rows.map((row) => row.getAttribute("aria-current"))).toEqual([
    "step",
    null,
    null,
    null,
    null,
  ]);
  // Each of Safari's screens has its picture in the scene, and Not what you see? stays.
  expect(document.querySelectorAll(".ui-play-layer .ui-picture")).toHaveLength(5);
  expect(screen.getByRole("button", { name: "Not what you see?" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
});

test("steps that aren't Safari's five pictured screens stay a list on /get-app (IN-10)", () => {
  installSteps("share-bar", true);
  expect(document.querySelector(".ui-play")).toBeNull();
  expect(document.querySelectorAll(".ui-steps > li")).toHaveLength(4);
});
