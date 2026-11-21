import "server-only";

import { sql } from "drizzle-orm";
import Papa from "papaparse";

import { db } from "@/db";
import { movies, type MovieWithCopies } from "@/db/schema";
import { CSV_COLUMNS, escapeCell, type CsvColumn } from "@/lib/csv-format";

function allMovies(): Promise<MovieWithCopies[]> {
  return db.query.movies.findMany({
    with: { copies: { orderBy: (c, { asc }) => asc(c.id) } },
    orderBy: [sql`${movies.isWishlist}`, sql`${movies.title} COLLATE NOCASE`, movies.id],
  });
}

export async function exportCsv(): Promise<string> {
  const rows: Record<CsvColumn, string>[] = [];
  for (const m of await allMovies()) {
    const base = {
      title: m.title,
      release_year: m.releaseYear?.toString() ?? "",
      director: m.director ?? "",
      cast: m.cast ?? "",
      genres: m.genres?.join("; ") ?? "",
      runtime: m.runtime?.toString() ?? "",
      synopsis: m.synopsis ?? "",
      tmdb_id: m.tmdbId?.toString() ?? "",
      poster_url: m.posterUrl ?? "",
      list: m.isWishlist ? "wishlist" : "owned",
      watch_status: m.watchStatus,
      rating: m.rating?.toString() ?? "",
      notes: m.notes ?? "",
      date_added: m.createdAt,
    };
    const copyRows = m.copies.length ? m.copies : [null];
    for (const c of copyRows) {
      const row = {
        ...base,
        format: c?.format ?? "",
        edition: c?.edition ?? "",
        purchase_date: c?.purchaseDate ?? "",
        price: c?.priceCents == null ? "" : (c.priceCents / 100).toFixed(2),
        condition: c?.condition ?? "",
      };
      rows.push(
        Object.fromEntries(CSV_COLUMNS.map((k) => [k, escapeCell(row[k])])) as Record<CsvColumn, string>,
      );
    }
  }
  // BOM so Excel opens it as UTF-8; CRLF per RFC 4180.
  return "﻿" + Papa.unparse({ fields: [...CSV_COLUMNS], data: rows }, { newline: "\r\n" });
}

export async function exportJson(): Promise<string> {
  const data = (await allMovies()).map(({ copies, ...m }) => ({
    ...m,
    copies: copies.map((c) => ({
      id: c.id,
      format: c.format,
      edition: c.edition,
      purchaseDate: c.purchaseDate,
      priceCents: c.priceCents,
      condition: c.condition,
    })),
  }));
  return JSON.stringify({ app: "movie-vault", version: 1, exportedAt: new Date().toISOString(), movies: data }, null, 2);
}
