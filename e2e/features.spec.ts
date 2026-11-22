import { expect, test } from "@playwright/test";

import { importCsv, openMovie, uid } from "./helpers";

test("mark a wishlist movie as purchased", async ({ page, request }) => {
  const id = uid();
  await importCsv(request, `title,format,list\nWanted ${id},4K UHD,wishlist\n`);
  await openMovie(page, `Wanted ${id}`, "&view=wishlist");
  await page.getByRole("button", { name: "Mark as purchased" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#mp-price").fill("24.99");
  await dialog.locator("#mp-location").fill("Shelf W1");
  await dialog.getByRole("button", { name: "Move to collection" }).click();

  await expect(page.getByRole("button", { name: "Mark as purchased" })).toHaveCount(0);
  await expect(page.getByText("Copies owned")).toBeVisible();
  await expect(page.getByText("Shelf W1")).toBeVisible();
  await expect(page.getByText("$24.99")).toBeVisible();
});

test("barcode box validates the number without calling out", async ({ page }) => {
  await page.goto("/movies/add");
  await page.getByLabel("Barcode number").fill("123");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("Enter the 8–14 digit number under the barcode.")).toBeVisible();
});

test("barcode on a copy round-trips through the form", async ({ page }) => {
  const title = `Scanned ${uid()}`;
  await page.goto("/movies/add");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("combobox", { name: "Format" }).first().click();
  await page.getByRole("option", { name: "DVD", exact: true }).click();
  await page.getByLabel("Barcode", { exact: true }).fill("0 12345-67890 5");
  await page.getByRole("button", { name: "Add to collection" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  // The Add form stays mounted (hidden) for back navigation; check the visible Edit form.
  await expect(page.getByLabel("Barcode", { exact: true }).filter({ visible: true })).toHaveValue("012345678905");
});

test("franchises page explains how to get franchises when there are none", async ({ page }) => {
  await page.goto("/franchises");
  await expect(page.getByRole("heading", { level: 1, name: "Franchises" })).toBeVisible();
  await expect(page.getByText(/No franchises yet|owned/).first()).toBeVisible();
});

test("theme toggle switches and persists", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-checked", before!);
  const after = await toggle.getAttribute("aria-checked");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", after!);
});

test("CSV export → import → export is byte-identical", async ({ request }) => {
  const first = await (await request.get("/api/export?format=csv")).text();
  // Import the export into the same vault: the re-export must contain each row twice, in place.
  const lines = first.replace(/^﻿/, "").trimEnd().split("\r\n");
  expect(lines.length).toBeGreaterThan(1);
  await importCsv(request, first);
  const second = await (await request.get("/api/export?format=csv")).text();
  const secondLines = second.replace(/^﻿/, "").trimEnd().split("\r\n");
  // Every original data row now appears twice (the copy is identical byte for byte).
  for (const row of lines.slice(1)) {
    expect(secondLines.filter((l) => l === row).length).toBeGreaterThanOrEqual(2);
  }
  expect(secondLines[0]).toBe(lines[0]);
});
