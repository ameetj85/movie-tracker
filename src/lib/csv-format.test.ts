import { describe, expect, it } from "vitest";

import {
  cleanPrice,
  escapeCell,
  parseDate,
  parseFormats,
  parseIsWishlist,
  parseWatchStatus,
  resolveColumns,
  unescapeCell,
} from "./csv-format";

describe("parseFormats", () => {
  it.each([
    ["Blu-ray", ["Blu-ray"]],
    ["bluray", ["Blu-ray"]],
    ["BD", ["Blu-ray"]],
    ["4K Ultra HD", ["4K UHD"]],
    // No separator: "4K Blu-ray" is the single 4K format, not two copies.
    ["4K Blu-ray", ["4K UHD"]],
    ["iTunes", ["Digital - Apple TV"]],
    ["Vudu / Fandango", ["Digital - Vudu/Fandango"]],
    ["Amazon", ["Digital - Amazon Prime"]],
    ["Prime Video", ["Digital - Amazon Prime"]],
    ["Digital - Amazon Prime", ["Digital - Amazon Prime"]],
  ])("normalizes %j", (raw, expected) => {
    expect(parseFormats(raw)).toEqual({ formats: expected, unknown: [] });
  });

  it("splits combo packs on explicit separators", () => {
    expect(parseFormats("4K + Blu-ray").formats).toEqual(["4K UHD", "Blu-ray"]);
    expect(parseFormats("Blu-ray, DVD & Digital").formats).toEqual(["Blu-ray", "DVD", "Digital - Other"]);
  });

  it("de-duplicates repeated formats", () => {
    expect(parseFormats("DVD + dvd").formats).toEqual(["DVD"]);
  });

  it("reports unknown parts", () => {
    expect(parseFormats("Laserdisc")).toEqual({ formats: [], unknown: ["Laserdisc"] });
  });

  it("treats an empty cell as no formats", () => {
    expect(parseFormats("  ")).toEqual({ formats: [], unknown: [] });
  });
});

describe("resolveColumns", () => {
  it("maps common alternative headers", () => {
    const { map } = resolveColumns(["Name", "Year", "Media Type", "Purchase Price", "Shelf", "Lent To"]);
    expect(map).toMatchObject({
      title: "Name",
      release_year: "Year",
      format: "Media Type",
      price: "Purchase Price",
      location: "Shelf",
      loaned_to: "Lent To",
    });
  });

  it("maps a CLZ-style Location column to location, not notes", () => {
    const { map } = resolveColumns(["Title", "Location", "Notes"]);
    expect(map.location).toBe("Location");
    expect(map.notes).toBe("Notes");
  });

  it("detects Letterboxd exports", () => {
    expect(resolveColumns(["Name", "Year", "Letterboxd URI"]).isLetterboxd).toBe(true);
    expect(resolveColumns(["Title"]).isLetterboxd).toBe(false);
  });
});

describe("cell helpers", () => {
  it("parses dates in several layouts and rejects impossible ones", () => {
    expect(parseDate("2024-02-29")).toBe("2024-02-29");
    expect(parseDate("3/7/2021")).toBe("2021-03-07");
    expect(parseDate("2023-02-29")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });

  it("cleans prices", () => {
    expect(cleanPrice("$1,299.99")).toBe("1299.99");
    expect(cleanPrice("19,99")).toBe("19.99");
  });

  it("reads watch status and list columns", () => {
    expect(parseWatchStatus("Yes")).toBe("watched");
    expect(parseWatchStatus("in progress")).toBe("in_progress");
    expect(parseWatchStatus("2024-05-01")).toBe("watched");
    expect(parseIsWishlist("wishlist", "list")).toBe(true);
    expect(parseIsWishlist("yes", "Owned")).toBe(false);
  });

  it("guards spreadsheet formulas and restores them on import", () => {
    for (const v of ["=SUM(A1)", "+1", "-2", "@x"]) {
      expect(escapeCell(v)).toBe(`'${v}`);
      expect(unescapeCell(escapeCell(v))).toBe(v);
    }
    expect(escapeCell("Plain")).toBe("Plain");
    expect(unescapeCell("'quoted")).toBe("'quoted");
  });
});
