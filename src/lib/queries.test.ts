import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { copies, movies, viewings } from "@/db/schema";
import { parseCollectionQuery } from "@/lib/collection-params";
import { countMovies, findByUpc, getFilterOptions, listFranchises, listMovies } from "@/lib/queries";

function add(movie: Partial<typeof movies.$inferInsert> & { title: string }, formats: string[] = ["Blu-ray"]) {
  const { id } = db.insert(movies).values(movie).returning({ id: movies.id }).get();
  for (const format of formats) db.insert(copies).values({ movieId: id, format }).run();
  return id;
}

const titles = async (params: Record<string, string>) =>
  (await listMovies(parseCollectionQuery(params))).map((m) => m.title);

beforeEach(() => {
  db.delete(viewings).run();
  db.delete(copies).run();
  db.delete(movies).run();
});

describe("upgrade candidates", () => {
  it("are owned only on DVD and/or VHS", async () => {
    add({ title: "DVD only" }, ["DVD"]);
    add({ title: "DVD and VHS" }, ["DVD", "VHS"]);
    add({ title: "DVD and Blu-ray" }, ["DVD", "Blu-ray"]);
    add({ title: "VHS and digital" }, ["VHS", "Digital - Other"]);
    add({ title: "4K" }, ["4K UHD"]);
    add({ title: "Wishlist DVD", isWishlist: true }, ["DVD"]);
    expect(await titles({ format: "@upgrade" })).toEqual(["DVD and VHS", "DVD only"]);
    expect((await getFilterOptions("owned")).anyUpgrade).toBe(true);
  });

  it("are not offered when nothing qualifies", async () => {
    add({ title: "4K" }, ["4K UHD"]);
    expect((await getFilterOptions("owned")).anyUpgrade).toBe(false);
  });
});

describe("tags", () => {
  it("filter case-insensitively and are searchable", async () => {
    add({ title: "Elf", tags: ["Christmas", "Kids"] });
    add({ title: "Die Hard", tags: ["christmas"] });
    add({ title: "Heat" });
    expect(await titles({ tag: "CHRISTMAS" })).toEqual(["Die Hard", "Elf"]);
    expect(await titles({ q: "kids" })).toEqual(["Elf"]);
    expect((await getFilterOptions("owned")).tags).toEqual(["Christmas", "Kids"]);
  });
});

describe("recently watched sort", () => {
  it("orders by the latest logged viewing, never-logged last", async () => {
    const a = add({ title: "A" });
    const b = add({ title: "B" });
    add({ title: "C" });
    db.insert(viewings).values([
      { movieId: a, watchedOn: "2024-01-01" },
      { movieId: b, watchedOn: "2023-06-01" },
      { movieId: b, watchedOn: "2025-03-01" },
    ]).run();
    expect(await titles({ sort: "watched" })).toEqual(["B", "A", "C"]);
  });
});

describe("franchises", () => {
  it("summarize owned and wishlisted films per TMDB collection", async () => {
    add({ title: "MI 1", tmdbCollectionId: 87359, tmdbCollectionName: "Mission: Impossible Collection" });
    add({ title: "MI 2", tmdbCollectionId: 87359, tmdbCollectionName: "Mission: Impossible Collection" });
    add({ title: "MI 3", isWishlist: true, tmdbCollectionId: 87359, tmdbCollectionName: "Mission: Impossible Collection" });
    add({ title: "Heat" });
    expect(await listFranchises()).toEqual([{ id: 87359, name: "Mission: Impossible Collection", owned: 2, wishlist: 1 }]);
  });
});

describe("pagination", () => {
  it("limits the list but counts every match", async () => {
    for (let i = 0; i < 65; i++) add({ title: `Movie ${String(i).padStart(2, "0")}` });
    const query = parseCollectionQuery({});
    expect(query.show).toBe(60);
    expect(await listMovies(query, query.show)).toHaveLength(60);
    expect(await countMovies(query)).toBe(65);
    expect(parseCollectionQuery({ show: "70" }).show).toBe(120);
    expect(parseCollectionQuery({ show: "-5" }).show).toBe(60);
  });
});

describe("barcodes", () => {
  it("find copies by UPC", async () => {
    const id = add({ title: "Heat" }, []);
    db.insert(copies).values({ movieId: id, format: "Blu-ray", upc: "024543617907" }).run();
    expect(await findByUpc("024543617907")).toEqual([{ movieId: id, title: "Heat", format: "Blu-ray", isWishlist: false }]);
    expect(await findByUpc("000000000000")).toEqual([]);
  });
});
