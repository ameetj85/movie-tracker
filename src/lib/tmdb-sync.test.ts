import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { copies, movies } from "@/db/schema";
import type { TmdbMovieDetails } from "@/lib/tmdb";

// TMDB and the poster download are faked: no network in unit tests.
const details: TmdbMovieDetails = {
  tmdbId: 954,
  title: "Mission: Impossible",
  releaseYear: 1996,
  director: "Brian De Palma",
  cast: "Tom Cruise, Jon Voight",
  genres: ["Action", "Thriller"],
  synopsis: "An IMF agent is framed.",
  runtime: 110,
  posterUrl: "https://image.tmdb.org/t/p/w500/mi.jpg",
  collection: { id: 87359, name: "Mission: Impossible Collection" },
};
vi.mock("@/lib/tmdb", () => ({ getTmdbMovie: vi.fn(async () => details) }));
vi.mock("@/lib/import", () => ({ matchTmdb: vi.fn(async (title: string) => (title === "Mission Impossible" ? 954 : null)) }));
vi.mock("@/lib/posters", () => ({
  cachePoster: vi.fn(async (url: string | null) => (url ? "/posters/cached.jpg" : null)),
  isLocalPoster: (url: string | null) => !!url?.startsWith("/posters/"),
}));

const { syncMovieFromTmdb } = await import("@/lib/tmdb-sync");

function insert(values: Partial<typeof movies.$inferInsert> & { title: string }) {
  return db.insert(movies).values(values).returning().get();
}
const reload = (id: number) => db.query.movies.findFirst({ where: (m, { eq }) => eq(m.id, id) });

beforeEach(() => {
  db.delete(copies).run();
  db.delete(movies).run();
});

describe("syncMovieFromTmdb", () => {
  it("fill mode only fills blanks and records the franchise", async () => {
    const m = insert({ title: "Mission Impossible", director: "My own note", rating: 9 });
    expect(await syncMovieFromTmdb(m, "fill")).toBe("updated");
    const after = await reload(m.id);
    expect(after).toMatchObject({
      tmdbId: 954,
      title: "Mission Impossible", // kept
      director: "My own note", // kept
      rating: 9, // personal field untouched
      releaseYear: 1996,
      runtime: 110,
      genres: ["Action", "Thriller"],
      posterUrl: "/posters/cached.jpg",
      tmdbCollectionId: 87359,
      tmdbCollectionName: "Mission: Impossible Collection",
    });
  });

  it("overwrite mode replaces metadata but keeps personal fields", async () => {
    const m = insert({ title: "MI", tmdbId: 954, director: "Wrong", rating: 7, notes: "Mine" });
    expect(await syncMovieFromTmdb(m, "overwrite")).toBe("updated");
    expect(await reload(m.id)).toMatchObject({ title: "Mission: Impossible", director: "Brian De Palma", rating: 7, notes: "Mine" });
  });

  it("reports unmatched titles and unchanged movies", async () => {
    expect(await syncMovieFromTmdb(insert({ title: "Unknown Film" }), "fill")).toBe("unmatched");
    const m = insert({ title: "MI", tmdbId: 954 });
    await syncMovieFromTmdb(m, "fill");
    expect(await syncMovieFromTmdb((await reload(m.id))!, "fill")).toBe("unchanged");
  });
});
