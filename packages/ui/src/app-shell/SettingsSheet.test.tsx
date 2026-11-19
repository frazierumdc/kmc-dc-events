import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { info } from "../../test/settings.tsx";

afterEach(cleanup);

test("Settings: the app, when the schedule was updated, three rows and the version (EV-41)", () => {
  info();
  expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toBeTruthy();
  expect(screen.getByText("Schedule updated October 26, 2026, 4:09 AM")).toBeTruthy();
  expect(screen.getByText("Version 20261026-abc1234")).toBeTruthy();
  expect(screen.getByText(/Already added\? You’re all set\./)).toBeTruthy();
  const add = screen.getByRole("link", { name: /Add to Home Screen/ });
  expect(add.getAttribute("href")).toBe("https://example.web.app/get-app");
  expect(add.textContent).toContain("Steps for your phone");
  expect(screen.getByRole("button", { name: "Privacy" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Share the app/ })).toBeTruthy();
  // The steps themselves are on /get-app, not in Settings (IN-10).
  expect(screen.queryByRole("listitem")).toBeNull();
  expect(screen.queryByRole("button", { name: "Not what you see?" })).toBeNull();
});

test("Settings on Android says home screen in lower case (IN-7)", () => {
  info({ guide: "android" });
  expect(screen.getByRole("link", { name: /Add to home screen/ })).toBeTruthy();
});

test("Privacy at the end of Settings opens the privacy page inside the sheet, with Back to Settings (IN-9)", () => {
  info();
  fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
  expect(screen.getByRole("heading", { level: 2, name: "Privacy" })).toBeTruthy();
  expect(screen.getByText("KMC DC Events collects no data about you.")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: "What stays on your phone" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "contact@example.org" }).getAttribute("href")).toBe(
    "mailto:contact@example.org",
  );
  expect(screen.queryByText("Version 20261026-abc1234")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toBeTruthy();
  expect(screen.getByText("Version 20261026-abc1234")).toBeTruthy();
});

test("Share the app opens the phone's share menu with the /get-app link, or copies it (IN-10)", async () => {
  const share = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  info();
  const button = screen.getByRole("button", { name: /Share the app/ });
  expect(button.textContent).toContain("Send someone the link to add it");
  fireEvent.click(button);
  expect(share).toHaveBeenCalledWith({ text: "https://example.web.app/get-app" });
  cleanup();

  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  info();
  fireEvent.click(screen.getByRole("button", { name: /Share the app/ }));
  expect(writeText).toHaveBeenCalledWith("https://example.web.app/get-app");
  expect(await screen.findByText("Link copied")).toBeTruthy();
});
