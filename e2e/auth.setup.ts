import { expect, test as setup } from "@playwright/test";

import { E2E_USER, STORAGE_STATE } from "./helpers";

// Every route requires a signed-in user. The e2e database starts empty, so create
// the first account through the real sign-up page and save its session cookie
// for the other tests (see `storageState` in playwright.config.ts).
setup("create the first account", async ({ page }) => {
  await page.goto("/");
  // A fresh install sends you from / to /login to /signup.
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("Name").fill(E2E_USER.name);
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_USER.password);
  await page.getByLabel("Confirm password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
