import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BottomArea } from "../shared/BottomArea.tsx";
import { FooterCard } from "../events/FooterCard.tsx";
import { Header } from "./Header.tsx";
import { detectPlatform, followsAppleTextSize } from "../shared/platform.ts";
import { Toast } from "../shared/Toast.tsx";
import { noop } from "../../test/support.tsx";

afterEach(cleanup);

const MEMBERSHIP = {
  title: "You belong here",
  intro: "Become a member and make meditation part of your life.",
  benefits: [
    "Free drop-in classes",
    "Free Friday Night Lectures",
    "Free or half-price courses and retreats",
  ],
  note: "Benefits vary by plan.",
  link: "https://www.example.org/pricing-plans/list",
};

test("header and footer: the membership card; no tab bar", () => {
  render(
    <>
      <Header
        logo={{ src: "/logo.png" }}
        centerName="Kadampa Meditation Center DC"
        title="Events"
      />
      <FooterCard membership={MEMBERSHIP} />
    </>,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Events" })).toBeTruthy();
  expect(document.querySelector(".ui-compact-sub")?.textContent).toBe(
    "Kadampa Meditation Center DC",
  );
  const card = screen.getByRole("region", { name: "You belong here" });
  expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe("You belong here");
  expect(
    within(card)
      .getAllByRole("listitem")
      .map((li) => li.textContent),
  ).toEqual(MEMBERSHIP.benefits);
  const plans = within(card).getByRole("link", { name: "See membership plans" });
  expect([plans.getAttribute("href"), plans.getAttribute("target"), plans.className]).toEqual([
    MEMBERSHIP.link,
    "_blank",
    "ui-btn ui-btn-outline",
  ]);
  expect(within(card).getByText("Benefits vary by plan.")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});

test("no membership settings: no card", () => {
  render(<FooterCard membership={null} />);
  expect(screen.queryByRole("region")).toBeNull();
});

test("Android phones get the Android look; everything else the iPhone look", () => {
  expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129")).toBe("android");
  expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
  expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("ios");
});

test("a toast sits at the bottom of the screen (EV-19)", () => {
  render(
    <BottomArea>
      <Toast message="Schedule updated" onClose={noop} />
    </BottomArea>,
  );
  const toast = screen.getByRole("status");
  expect(toast.textContent).toBe("Schedule updated");
  expect(toast.parentElement?.className).toBe("ui-bottom");
});

test("the toast stays until its ✕ is pressed (EV-19)", () => {
  const onClose = vi.fn();
  render(<Toast message="Schedule updated" onClose={onClose} />);
  const close = screen.getByRole("button", { name: "Close" });
  expect(close.className).toBe("ui-toast-close");
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the toast's live region is there before any message, so each one is announced", () => {
  const { rerender } = render(<Toast message={null} onClose={noop} />);
  const region = screen.getByRole("status");
  expect(region.textContent).toBe("");
  rerender(<Toast message="Schedule updated" onClose={noop} />);
  expect(screen.getByRole("status")).toBe(region);
  expect(region.textContent).toBe("Schedule updated");
});

test("a message going away fades out, hidden from screen readers and taps, then is gone", () => {
  vi.useFakeTimers();
  try {
    const { rerender } = render(<Toast message="Schedule updated" onClose={noop} />);
    rerender(<Toast message={null} onClose={noop} />);
    const leaving = document.querySelector(".ui-leaving");
    expect(leaving?.getAttribute("aria-hidden")).toBe("true");
    expect(leaving?.hasAttribute("inert")).toBe(true);
    expect(leaving?.textContent).toBe("Schedule updated");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("status").textContent).toBe("");
    // A new message shows at once.
    rerender(<Toast message="Schedule updated" onClose={noop} />);
    expect(screen.getByRole("status").textContent).toBe("Schedule updated");
    expect(document.querySelector(".ui-leaving")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test("only a real iPhone or iPad takes its text size from -apple-system-body (NFR-2)", () => {
  expect(followsAppleTextSize("iPhone", 5)).toBe(true);
  expect(followsAppleTextSize("iPad", 5)).toBe(true);
  expect(followsAppleTextSize("MacIntel", 5)).toBe(true); // iPad asking for the desktop site
  expect(followsAppleTextSize("MacIntel", 0)).toBe(false); // a Mac, where it means 13px
  expect(followsAppleTextSize("Linux armv8l", 5)).toBe(false);
});

test("the header is one heading, the small title, with the center's name under it, both read out (EV-22)", () => {
  render(<Header logo={{ src: "/logo.png" }} centerName="KMC DC" title="Events" />);
  expect(screen.getAllByRole("heading")).toHaveLength(1);
  const compact = document.querySelector(".ui-compact-title");
  expect(compact?.closest("[aria-hidden]")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Events");
  expect(
    [".ui-compact-main", ".ui-compact-sub"].map((s) => compact?.querySelector(s)?.textContent),
  ).toEqual(["Events", "KMC DC"]);
  expect(document.querySelector(".ui-largetitle")).toBeNull();
});
