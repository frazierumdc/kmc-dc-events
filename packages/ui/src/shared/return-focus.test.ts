import { afterEach, expect, test } from "vitest";
import { returnFocus } from "./return-focus.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

function button() {
  const el = document.createElement("button");
  document.body.append(el);
  return el;
}

test("after a touch, focus goes back with no ring (EV-36, EV-41)", () => {
  const el = button();
  document.dispatchEvent(new Event("pointerdown"));
  returnFocus(el);
  expect(document.activeElement).toBe(el);
  expect(el.dataset.quietFocus).toBe("");
});

test("leaving the app and coming back keeps the ring hidden", () => {
  const el = button();
  document.dispatchEvent(new Event("pointerdown"));
  returnFocus(el);
  // The app goes to the background, then the phone gives the element its focus back.
  el.blur();
  el.focus();
  expect(el.dataset.quietFocus).toBe("");
});

test("a key, or focus moving to something else, lets the ring show again", () => {
  const el = button();
  const other = button();
  document.dispatchEvent(new Event("pointerdown"));
  returnFocus(el);
  other.focus();
  expect(el.dataset.quietFocus).toBeUndefined();

  document.dispatchEvent(new Event("pointerdown"));
  returnFocus(el);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
  expect(el.dataset.quietFocus).toBeUndefined();
});

test("after a key such as Escape, focus goes back with the ring", () => {
  const el = button();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  returnFocus(el);
  expect(document.activeElement).toBe(el);
  expect(el.dataset.quietFocus).toBeUndefined();
});
