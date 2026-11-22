import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Import movies through the real CSV import endpoint (fast seeding). */
export async function importCsv(request: APIRequestContext, csv: string) {
  const res = await request.post("/api/import", {
    data: { mode: "commit", csv, options: { defaultFormat: null, skipExisting: false, enrich: false } },
  });
  expect(res.ok()).toBe(true);
  const last = (await res.text()).trim().split("\n").pop()!;
  const line = JSON.parse(last) as { type: string; imported?: number; message?: string };
  expect(line.type, line.message).toBe("result");
  return line;
}

/** A unique suffix so tests sharing one database don't collide. */
export const uid = () => Math.random().toString(36).slice(2, 7);

/** Open a movie's page from the collection grid by its title. */
export async function openMovie(page: Page, title: string, query = "") {
  await page.goto(`/?q=${encodeURIComponent(title)}${query}`);
  await page.locator("main ul.grid").getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Pick an option in one of the collection page's filter dropdowns. */
export async function pickFilter(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}
