import { expect, test } from "@playwright/test";

import { importCsv, openMovie, pickFilter, uid } from "./helpers";

test("add a movie by hand with a tag, location and loan", async ({ page }) => {
  const title = `Handmade ${uid()}`;
  await page.goto("/movies/add");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("combobox", { name: "Format" }).first().click();
  await page.getByRole("option", { name: "Blu-ray", exact: true }).click();
  await page.getByLabel("Location").fill("Shelf Q9");
  await page.getByLabel("Loaned to").fill("Sam");
  await page.getByLabel("Tags").fill("E2E night, Favourites");
  await page.getByRole("button", { name: "Add to collection" }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Shelf Q9")).toBeVisible();
  await expect(page.getByText("Loaned to Sam")).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E night" })).toBeVisible();

  // The tag chip links to the tag filter.
  await page.getByRole("link", { name: "E2E night" }).click();
  await expect(page.locator("main ul.grid").getByRole("link", { name: new RegExp(title) })).toBeVisible();
});

test("upgrade candidates are owned only on DVD/VHS", async ({ page, request }) => {
  const id = uid();
  await importCsv(
    request,
    `title,format\nOld DVD ${id},DVD\nOld Tape ${id},VHS\nBetter ${id},DVD + Blu-ray\n`,
  );
  await page.goto(`/?q=${id}`);
  await pickFilter(page, "Format", /Upgrade candidates/);
  const grid = page.locator("main ul.grid");
  await expect(grid.getByRole("link", { name: new RegExp(`Old DVD ${id}`) })).toBeVisible();
  await expect(grid.getByRole("link", { name: new RegExp(`Old Tape ${id}`) })).toBeVisible();
  await expect(grid.getByRole("link", { name: new RegExp(`Better ${id}`) })).toHaveCount(0);
});

test("bulk select: tag several movies, then mark them watched", async ({ page, request }) => {
  const id = uid();
  await importCsv(request, `title,format\nBulk A ${id},DVD\nBulk B ${id},DVD\nBulk C ${id},DVD\n`);
  await page.goto(`/?q=${id}`);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: `Select Bulk A ${id}` }).click();
  await page.getByRole("button", { name: `Select Bulk B ${id}` }).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: "Add tag" }).click();
  await page.getByLabel("Tag name").fill(`Batch ${id}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(`Tagged 2 movies “Batch ${id}”.`)).toBeVisible();

  await page.getByRole("button", { name: "Mark watched" }).click();
  await expect(page.getByText("Updated 2 movies.")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.goto(`/?tag=${encodeURIComponent(`Batch ${id}`)}&status=watched`);
  const grid = page.locator("main ul.grid");
  await expect(grid.getByRole("listitem")).toHaveCount(2);
  await expect(grid.getByRole("link", { name: new RegExp(`Bulk C ${id}`) })).toHaveCount(0);
});

test("bulk delete asks for confirmation", async ({ page, request }) => {
  const id = uid();
  await importCsv(request, `title,format\nDoomed ${id},DVD\nKept ${id},DVD\n`);
  await page.goto(`/?q=${id}`);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: `Select Doomed ${id}` }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted 1 movie.")).toBeVisible();
  await expect(page.locator("main ul.grid").getByRole("listitem")).toHaveCount(1);
});

test("watch history: log a viewing and sort by recently watched", async ({ page, request }) => {
  const id = uid();
  await importCsv(request, `title,format\nDiary ${id},Blu-ray\nNever Seen ${id},Blu-ray\n`);
  await openMovie(page, `Diary ${id}`);
  await page.getByRole("button", { name: "Log a viewing" }).click();
  await page.getByLabel("Note").fill("rainy Sunday");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("rainy Sunday")).toBeVisible();
  await expect(page.getByRole("article").getByText("Watched", { exact: true })).toBeVisible();

  await page.goto(`/?q=${id}&sort=watched&layout=list`);
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText(`Diary ${id}`);
  await expect(rows.nth(1)).toContainText(`Never Seen ${id}`);
});

test("pagination shows 60 at a time", async ({ page, request }) => {
  const id = uid();
  const rows = Array.from({ length: 65 }, (_, i) => `Page ${id} ${String(i).padStart(2, "0")},DVD`).join("\n");
  await importCsv(request, `title,format\n${rows}\n`);
  await page.goto(`/?q=${encodeURIComponent(`Page ${id}`)}`);
  const grid = page.locator("main ul.grid");
  await expect(grid.getByRole("listitem")).toHaveCount(60);
  await expect(page.getByText("Showing 60 of 65")).toBeVisible();
  await page.getByRole("link", { name: "Show 5 more" }).click();
  await expect(grid.getByRole("listitem")).toHaveCount(65);
  await expect(page.getByRole("link", { name: /Show \d+ more/ })).toHaveCount(0);
});

test("surprise me opens an unwatched movie", async ({ page, request }) => {
  const id = uid();
  await importCsv(request, `title,format,watched\nPick Me ${id},DVD,no\nSeen It ${id},DVD,yes\n`);
  await page.goto(`/?q=${id}`);
  await page.getByRole("button", { name: "Surprise me" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Pick Me ${id}` })).toBeVisible();
});
