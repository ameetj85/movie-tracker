import { describe, expect, it } from "vitest";

import { copySchema, movieInputSchema, type MovieFormValues } from "./validation";

const baseMovie = (patch: Partial<MovieFormValues> = {}): MovieFormValues => ({
  tmdbId: null,
  title: "Heat",
  releaseYear: "1995",
  director: "",
  cast: "",
  genres: "Crime, Thriller, crime",
  posterUrl: "",
  synopsis: "",
  runtime: "",
  isWishlist: false,
  watchStatus: "unwatched",
  rating: "",
  notes: "",
  copies: [{ format: "Blu-ray", edition: "", purchaseDate: "", price: "$19.99", condition: "" }],
  ...patch,
});

describe("movieInputSchema", () => {
  it("converts form strings to typed values", () => {
    const m = movieInputSchema.parse(baseMovie());
    expect(m.releaseYear).toBe(1995);
    expect(m.director).toBeNull();
    expect(m.genres).toEqual(["Crime", "Thriller", "crime"]);
    expect(m.copies[0].price).toBe(1999);
  });

  it("requires a format for owned movies but not for wishlist ones", () => {
    expect(movieInputSchema.safeParse(baseMovie({ copies: [] })).success).toBe(false);
    expect(movieInputSchema.safeParse(baseMovie({ copies: [], isWishlist: true })).success).toBe(true);
  });

  it("rejects out-of-range numbers", () => {
    expect(movieInputSchema.safeParse(baseMovie({ rating: "11" })).success).toBe(false);
    expect(movieInputSchema.safeParse(baseMovie({ releaseYear: "1500" })).success).toBe(false);
  });
});

describe("copySchema", () => {
  const copy = { format: "DVD", edition: "", purchaseDate: "", price: "", condition: "" };

  it("drops a loan date when there's no borrower", () => {
    const c = copySchema.parse({ ...copy, loanedTo: "  ", loanedOn: "2026-01-02" });
    expect(c.loanedTo).toBeNull();
    expect(c.loanedOn).toBeNull();
  });

  it("keeps the loan date with a borrower", () => {
    const c = copySchema.parse({ ...copy, loanedTo: "Sam", loanedOn: "2026-01-02" });
    expect(c).toMatchObject({ loanedTo: "Sam", loanedOn: "2026-01-02" });
  });

  it("treats location and loan fields as optional", () => {
    expect(copySchema.parse(copy)).toMatchObject({ location: null, loanedTo: null, loanedOn: null });
  });

  it("rejects malformed dates", () => {
    expect(copySchema.safeParse({ ...copy, purchaseDate: "02/03/2024" }).success).toBe(false);
  });
});
