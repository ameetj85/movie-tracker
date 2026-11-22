import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { copies, movies } from "@/db/schema";
import { exportCsv } from "@/lib/export";
import { commitImport, planImport, type ImportOptions } from "@/lib/import";

const OPTIONS: ImportOptions = { defaultFormat: null, skipExisting: false, enrich: false };

function wipe() {
  db.delete(copies).run();
  db.delete(movies).run();
}

/** A deliberately awkward collection: combos, loans, commas, quotes, formula-like text. */
function seed() {
  const add = (
    movie: Partial<typeof movies.$inferInsert> & { title: string },
    copyRows: Partial<typeof copies.$inferInsert>[],
  ) => {
    const { id } = db.insert(movies).values(movie).returning({ id: movies.id }).get();
    for (const c of copyRows) db.insert(copies).values({ format: "Blu-ray", ...c, movieId: id }).run();
  };
  add(
    {
      title: "Alien",
      releaseYear: 1979,
      director: "Ridley Scott",
      cast: "Sigourney Weaver, Tom Skerritt",
      genres: ["Horror", "Science Fiction"],
      rating: 10,
      watchStatus: "watched",
      notes: 'Says "in space" on the box',
      tags: ["Sci-fi night", "Classics"],
      createdAt: "2024-01-02 03:04:05",
    },
    [
      { format: "4K UHD", edition: "Steelbook", purchaseDate: "2024-02-29", priceCents: 3499, condition: "Like New", location: "Shelf A1", upc: "012345678905" },
      { format: "Blu-ray", location: "Shelf A1", loanedTo: "Sam, from work", loanedOn: "2026-11-01" },
    ],
  );
  add({ title: "Zodiac", releaseYear: 2007, watchStatus: "in_progress", createdAt: "2024-05-06 07:08:09" }, [
    { format: "DVD", loanedTo: "=Bob", location: "-Basement" },
  ]);
  add({ title: "Arrival", createdAt: "2025-01-01 00:00:00" }, [{ format: "Digital - Amazon Prime" }]);
  add({ title: "Dune: Part Two", releaseYear: 2024, isWishlist: true, createdAt: "2025-06-01 12:00:00" }, [
    { format: "4K UHD" },
    { format: "Blu-ray" },
  ]);
  add({ title: "No Copies Wishlist", isWishlist: true, createdAt: "2025-06-02 12:00:00" }, []);
}

describe("CSV export → import → export", () => {
  beforeEach(() => {
    wipe();
    seed();
  });

  it("reproduces the export byte for byte", async () => {
    const first = await exportCsv();

    wipe();
    const plan = planImport(first, OPTIONS);
    if ("fatal" in plan) throw new Error(plan.fatal);
    expect(plan.issues.filter((i) => i.level === "error")).toEqual([]);
    await commitImport(plan, OPTIONS, () => {});

    const second = await exportCsv();
    expect(second).toBe(first);
  });

  it("includes tags, locations, loans and barcodes", async () => {
    const csv = await exportCsv();
    expect(csv.split("\r\n")[0]).toContain(",tags,");
    expect(csv).toContain("Sci-fi night; Classics");
    expect(csv).toContain("012345678905");
    expect(csv).toContain('"Sam, from work",2026-11-01');
  });

  it("guards formula-like cells in the file", async () => {
    const csv = await exportCsv();
    expect(csv).toContain("'=Bob");
    expect(csv).toContain("'-Basement");
  });
});
