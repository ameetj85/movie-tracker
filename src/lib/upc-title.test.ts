import { describe, expect, it } from "vitest";

import { cleanUpcTitle, guessUpcFormat, normalizeUpc } from "./upc-title";

describe("cleanUpcTitle", () => {
  it.each([
    ["The Dark Knight (Blu-ray + DVD + Digital Copy)", "The Dark Knight"],
    ["Inception [Blu-ray]", "Inception"],
    ["Jurassic Park 4K Ultra HD + Blu-ray + Digital", "Jurassic Park"],
    ["Heat (Director's Definitive Edition) [4K UHD]", "Heat (Director's Definitive Edition)"],
    ["Alien (Widescreen) (DVD)", "Alien"],
    ["Blade Runner 2049 - Steelbook", "Blade Runner 2049"],
    ["Mad Max: Fury Road (2-Disc Special Edition)", "Mad Max: Fury Road"],
    // A real UPCitemdb result: a distributor prefix plus a bracketed format.
    ["Mill Creek - Fight Club [BLU-RAY]", "Fight Club"],
    ["Criterion Collection - Seven Samurai (Blu-ray)", "Seven Samurai"],
    // Only known labels are stripped, never part of the film's own title.
    ["Star Wars - A New Hope (DVD)", "Star Wars - A New Hope"],
    // The film's own name is never stripped down to nothing.
    ["Blu-ray", "Blu-ray"],
  ])("%j → %j", (raw, expected) => {
    expect(cleanUpcTitle(raw)).toBe(expected);
  });
});

describe("guessUpcFormat", () => {
  it("prefers the best format named in a combo pack", () => {
    expect(guessUpcFormat("Dune 4K Ultra HD + Blu-ray")).toBe("4K UHD");
    expect(guessUpcFormat("Inception (Blu-ray + DVD)")).toBe("Blu-ray");
    expect(guessUpcFormat("Alien (Widescreen) (DVD)")).toBe("DVD");
    expect(guessUpcFormat("Some Film")).toBeNull();
  });
});

describe("normalizeUpc", () => {
  it("accepts 8–14 digits with spaces or dashes", () => {
    expect(normalizeUpc("0 24543-61790 7")).toBe("024543617907");
    expect(normalizeUpc("12345")).toBeNull();
    expect(normalizeUpc("abc123456789")).toBeNull();
  });
});
