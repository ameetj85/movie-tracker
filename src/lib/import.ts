import "server-only";

import { existsSync } from "node:fs";

import Papa from "papaparse";

import { db } from "@/db";
import { copies, movies } from "@/db/schema";
import { createBackup } from "@/lib/backup";
import { FORMATS, type WatchStatus } from "@/lib/constants";
import {
  cleanPrice,
  cleanYear,
  parseDate,
  parseFormats,
  parseIsWishlist,
  parseTimestamp,
  parseWatchStatus,
  resolveColumns,
  splitList,
  unescapeCell,
  type ColumnMap,
  type CsvColumn,
} from "@/lib/csv-format";
import { cachePoster, isLocalPoster, LOCAL_POSTER_PREFIX, posterFilePath } from "@/lib/posters";
import { findExistingFilm } from "@/lib/queries";
import { getTmdbMovie, isTmdbConfigured, searchTmdb } from "@/lib/tmdb";
import { movieInputSchema, type MovieFormValues, type MovieInput } from "@/lib/validation";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type ImportOptions = {
  /** Applied to owned rows that have no format. */
  defaultFormat: string | null;
  /** Skip films already in the collection (same TMDB id or title + year). */
  skipExisting: boolean;
  /** Look up missing details/posters on TMDB. */
  enrich: boolean;
};

export type RowIssue = { row: number; level: "error" | "warning"; message: string };

type PlannedMovie = {
  rows: number[];
  input: MovieInput;
  createdAt: string | null;
};

export type ImportPlan = {
  totalRows: number;
  columns: ColumnMap;
  unmappedHeaders: string[];
  isLetterboxd: boolean;
  movies: PlannedMovie[];
  existing: { title: string; releaseYear: number | null; rows: number[] }[];
  /** Owned rows that need a format (only non-zero when no default format is set). */
  missingFormatRows: number[];
  issues: RowIssue[];
};

type Group = {
  key: string;
  rows: number[];
  values: MovieFormValues;
  createdAt: string | null;
};

/** Parse and validate a CSV without touching the database (except duplicate lookups). */
export function planImport(text: string, options: ImportOptions): ImportPlan | { fatal: string } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  if (headers.length === 0) return { fatal: "The file has no header row." };
  if (parsed.data.length === 0) return { fatal: "The file has no data rows." };
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return { fatal: `The file has ${parsed.data.length.toLocaleString()} rows; the limit is ${MAX_IMPORT_ROWS.toLocaleString()}.` };
  }

  const { map, isLetterboxd } = resolveColumns(headers);
  if (!map.title) {
    return { fatal: `Couldn't find a title column. Found: ${headers.slice(0, 12).join(", ")}.` };
  }
  const mapped = new Set(Object.values(map));
  const unmappedHeaders = headers.filter((h) => !mapped.has(h));

  const issues: RowIssue[] = [];
  const missingFormatRows: number[] = [];
  const groups = new Map<string, Group>();

  for (const e of parsed.errors) {
    if (e.type === "FieldMismatch") continue; // ragged rows are fine; missing cells read as ""
    issues.push({ row: (e.row ?? 0) + 2, level: "error", message: `CSV parse error: ${e.message}` });
  }

  parsed.data.forEach((record, i) => {
    const row = i + 2; // 1-based, after the header line
    const get = (col: CsvColumn) => {
      const h = map[col];
      return h ? unescapeCell(String(record[h] ?? "")).trim() : "";
    };
    const warn = (message: string) => issues.push({ row, level: "warning", message });
    const fail = (message: string) => issues.push({ row, level: "error", message });

    const title = get("title");
    if (!title) {
      // Fully blank rows are skipped by the parser; this is a row with data but no title.
      fail("Missing title.");
      return;
    }

    let isWishlist = false;
    if (map.list && get("list")) {
      const w = parseIsWishlist(get("list"), map.list);
      if (w === null) warn(`Unrecognized list value "${get("list")}"; treated as owned.`);
      else isWishlist = w;
    }

    let watchStatus: WatchStatus = isLetterboxd ? "watched" : "unwatched";
    if (map.watch_status && get("watch_status")) {
      const s = parseWatchStatus(get("watch_status"));
      if (s === null) warn(`Unrecognized watch status "${get("watch_status")}"; treated as unwatched.`);
      else watchStatus = s;
    }

    let rating = "";
    const rawRating = get("rating");
    if (rawRating) {
      const n = Number(rawRating.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n < 0) warn(`Ignored invalid rating "${rawRating}".`);
      else if (n > 0) {
        // Letterboxd rates 0.5–5 stars; this app uses 1–10.
        const scaled = Math.round(isLetterboxd ? n * 2 : n);
        if (scaled < 1 || scaled > 10) warn(`Ignored rating "${rawRating}" (expected 1–10).`);
        else rating = String(scaled);
      }
    }

    const tmdbRaw = get("tmdb_id");
    const tmdbId = /^\d+$/.test(tmdbRaw) && Number(tmdbRaw) > 0 ? Number(tmdbRaw) : null;
    if (tmdbRaw && tmdbId === null) warn(`Ignored invalid TMDB id "${tmdbRaw}".`);

    const releaseYear = get("release_year") ? cleanYear(get("release_year")) : "";

    let posterUrl = get("poster_url");
    if (isLocalPoster(posterUrl)) {
      // A local poster from another machine's export won't exist here.
      const file = posterFilePath(posterUrl.slice(LOCAL_POSTER_PREFIX.length));
      if (!file || !existsSync(file)) posterUrl = "";
    }

    // Formats → copies
    const { formats, unknown } = parseFormats(get("format"));
    if (unknown.length) {
      fail(`Unknown format "${unknown.join(", ")}". Use one of: ${FORMATS.join(", ")}.`);
      return;
    }
    if (formats.length === 0 && !isWishlist) {
      if (options.defaultFormat) formats.push(options.defaultFormat);
      else {
        missingFormatRows.push(row);
        return;
      }
    }
    let purchaseDate = "";
    if (get("purchase_date")) {
      purchaseDate = parseDate(get("purchase_date")) ?? "";
      if (!purchaseDate) warn(`Ignored unreadable purchase date "${get("purchase_date")}".`);
    }
    let loanedOn = "";
    if (get("loaned_on")) {
      loanedOn = parseDate(get("loaned_on")) ?? "";
      if (!loanedOn) warn(`Ignored unreadable loan date "${get("loaned_on")}".`);
    }
    const price = get("price") ? cleanPrice(get("price")) : "";
    const rowCopies = formats.map((format, idx) => ({
      format,
      edition: get("edition"),
      purchaseDate,
      // A combo pack's price belongs to the pack, so record it once.
      price: idx === 0 ? price : "",
      condition: get("condition"),
      // A combo pack sits on one shelf and is lent out as one item.
      location: get("location"),
      loanedTo: get("loaned_to"),
      loanedOn,
      upc: get("upc"),
    }));

    const key = tmdbId
      ? `tmdb:${tmdbId}:${isWishlist}`
      : `${title.toLowerCase()}|${releaseYear}|${isWishlist}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.values.copies.push(...rowCopies);
      return;
    }
    groups.set(key, {
      key,
      rows: [row],
      createdAt: map.date_added ? parseTimestamp(get("date_added")) : null,
      values: {
        tmdbId,
        title,
        releaseYear,
        director: get("director"),
        cast: splitList(get("cast")).join(", "),
        genres: splitList(get("genres")).join(", "),
        posterUrl,
        synopsis: get("synopsis"),
        runtime: get("runtime").replace(/[^\d]/g, ""),
        isWishlist,
        watchStatus,
        rating,
        notes: get("notes"),
        tags: splitList(get("tags")).join(", "),
        copies: rowCopies,
      },
    });
  });

  const plannedMovies: PlannedMovie[] = [];
  const existing: ImportPlan["existing"] = [];
  for (const g of groups.values()) {
    const result = movieInputSchema.safeParse(g.values);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`)
        .join("; ");
      for (const row of g.rows) issues.push({ row, level: "error", message });
      continue;
    }
    const input = result.data;
    if (options.skipExisting && findExistingFilm(input.title, input.releaseYear, input.tmdbId)) {
      existing.push({ title: input.title, releaseYear: input.releaseYear, rows: g.rows });
      continue;
    }
    plannedMovies.push({ rows: g.rows, input, createdAt: g.createdAt });
  }

  issues.sort((a, b) => a.row - b.row);
  return {
    totalRows: parsed.data.length,
    columns: map,
    unmappedHeaders,
    isLetterboxd,
    movies: plannedMovies,
    existing,
    missingFormatRows,
    issues,
  };
}

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "");

/** Best TMDB match: same normalized title and (if known) release year within ±1. */
export async function matchTmdb(title: string, year: number | null): Promise<number | null> {
  const want = normTitle(title);
  const pick = (results: Awaited<ReturnType<typeof searchTmdb>>) =>
    results.find(
      (r) =>
        normTitle(r.title) === want &&
        (year == null || r.releaseYear == null || Math.abs(r.releaseYear - year) <= 1),
    );
  const hit = pick(await searchTmdb(title, year ?? undefined)) ?? (year ? pick(await searchTmdb(title)) : undefined);
  return hit?.tmdbId ?? null;
}

const needsEnrichment = (m: MovieInput) =>
  !m.tmdbId || !m.posterUrl || !m.releaseYear || !m.director || !m.genres || !m.synopsis || !m.runtime || !m.cast;

/** Fill blank fields from TMDB; never overwrites values that came from the file. */
async function enrich(m: MovieInput): Promise<{ input: MovieInput; matched: boolean }> {
  const tmdbId = m.tmdbId ?? (await matchTmdb(m.title, m.releaseYear));
  if (!tmdbId) return { input: m, matched: false };
  const d = await getTmdbMovie(tmdbId);
  return {
    matched: true,
    input: {
      ...m,
      tmdbId,
      releaseYear: m.releaseYear ?? d.releaseYear,
      director: m.director ?? d.director,
      cast: m.cast ?? d.cast,
      genres: m.genres ?? (d.genres.length ? d.genres : null),
      synopsis: m.synopsis ?? d.synopsis,
      runtime: m.runtime ?? d.runtime,
      posterUrl: m.posterUrl ?? d.posterUrl,
      tmdbCollectionId: m.tmdbCollectionId ?? d.collection?.id ?? null,
      tmdbCollectionName: m.tmdbCollectionName ?? d.collection?.name ?? null,
    },
  };
}

/** Run `fn` over items with bounded concurrency, reporting progress. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, onDone: () => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      onDone();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export type ImportProgress = { phase: "tmdb" | "posters" | "saving"; done: number; total: number };

export type ImportResult = {
  imported: number;
  copies: number;
  matchedOnTmdb: number;
  unmatchedTitles: string[];
  postersCached: number;
  lookupErrors: number;
};

export async function commitImport(
  plan: ImportPlan,
  options: ImportOptions,
  onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {
  let items = plan.movies.map((m) => ({ ...m }));
  let matchedOnTmdb = 0;
  let lookupErrors = 0;
  const unmatchedTitles: string[] = [];

  if (options.enrich && isTmdbConfigured()) {
    const targets = items.filter((m) => needsEnrichment(m.input));
    let done = 0;
    onProgress({ phase: "tmdb", done, total: targets.length });
    const enriched = await pool(
      targets,
      4,
      async (m) => {
        try {
          const r = await enrich(m.input);
          if (r.matched) matchedOnTmdb++;
          else unmatchedTitles.push(m.input.title);
          return r.input;
        } catch {
          lookupErrors++;
          return m.input;
        }
      },
      () => onProgress({ phase: "tmdb", done: ++done, total: targets.length }),
    );
    const byPlan = new Map(targets.map((t, i) => [t, enriched[i]]));
    items = items.map((m) => (byPlan.has(m) ? { ...m, input: byPlan.get(m)! } : m));
  }

  // Download remote posters so the imported collection works offline.
  const remote = items.filter((m) => m.input.posterUrl && !isLocalPoster(m.input.posterUrl));
  let postersCached = 0;
  let pDone = 0;
  onProgress({ phase: "posters", done: 0, total: remote.length });
  await pool(
    remote,
    6,
    async (m) => {
      const local = await cachePoster(m.input.posterUrl);
      if (local !== m.input.posterUrl) postersCached++;
      m.input = { ...m.input, posterUrl: local };
    },
    () => onProgress({ phase: "posters", done: ++pDone, total: remote.length }),
  );

  onProgress({ phase: "saving", done: 0, total: items.length });
  // Snapshot the collection first, so a bad import can be rolled back by hand.
  if (db.$client.prepare("SELECT 1 FROM movies LIMIT 1").get()) {
    try {
      await createBackup("pre-import");
    } catch (err) {
      console.error("Pre-import backup failed:", err);
    }
  }
  let copyCount = 0;
  db.transaction((tx) => {
    for (const { input: m, createdAt } of items) {
      const row = tx
        .insert(movies)
        .values({
          tmdbId: m.tmdbId,
          title: m.title,
          releaseYear: m.releaseYear,
          director: m.director,
          cast: m.cast,
          genres: m.genres,
          posterUrl: m.posterUrl,
          synopsis: m.synopsis,
          runtime: m.runtime,
          isWishlist: m.isWishlist,
          watchStatus: m.watchStatus,
          rating: m.rating,
          notes: m.notes,
          tags: m.tags,
          tmdbCollectionId: m.tmdbCollectionId,
          tmdbCollectionName: m.tmdbCollectionName,
          ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
        })
        .returning({ id: movies.id })
        .get();
      if (m.copies.length) {
        tx.insert(copies)
          .values(
            m.copies.map((c) => ({
              movieId: row.id,
              format: c.format,
              edition: c.edition,
              purchaseDate: c.purchaseDate,
              priceCents: c.price,
              condition: c.condition,
              location: c.location,
              loanedTo: c.loanedTo,
              loanedOn: c.loanedOn,
              upc: c.upc,
            })),
          )
          .run();
        copyCount += m.copies.length;
      }
    }
  });
  onProgress({ phase: "saving", done: items.length, total: items.length });

  return {
    imported: items.length,
    copies: copyCount,
    matchedOnTmdb,
    unmatchedTitles,
    postersCached,
    lookupErrors,
  };
}
