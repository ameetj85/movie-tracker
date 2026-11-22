import { expect, test } from "@playwright/test";

import { E2E_USER } from "./helpers";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages redirect to sign-in and come back afterwards; APIs return 401", async ({ page, request }) => {
    await page.goto("/data");
    await expect(page).toHaveURL(/\/login\?next=%2Fdata$/);
    // Sign-up is closed once the first account exists.
    await expect(page.getByRole("link", { name: "Create one" })).toHaveCount(0);

    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Password").fill("wrong password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/data$/);
    await expect(page.getByRole("heading", { level: 1, name: "Import & export" })).toBeVisible();

    const res = await request.get("/api/random");
    expect(res.status()).toBe(401);
  });

  test("forgot password never reveals whether an account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for nobody@example.com")).toBeVisible();

    await page.goto("/reset-password?token=not-a-real-token");
    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  });
});

test("sign out ends the session", async ({ browser }) => {
  // A separate sign-in, so signing out doesn't revoke the shared session other tests use.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});
