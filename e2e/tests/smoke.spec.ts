import { expect, test } from "@playwright/test";

test("the app opens and shows the center's name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
  await expect(page.locator(".ui-compact-sub")).toHaveText("Kadampa Meditation Center DC");
  await expect(page.locator(".ui-compact-sub")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" }).getByText(/^Version /)).toBeVisible();
});
