import "server-only";

import { and, between, count, desc, eq, exists, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { copies, movies, type MovieWithCopies } from "@/db/schema";
import { DIGITAL_FILTER, type CollectionQuery, type SortKey } from "@/lib/collection-params";

/** Case-insensitive substring match with LIKE wildcards in the term escaped. */
function contains(column: AnySQLiteColumn, term: string): SQL {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

const titleOrder = sql`${movies.title} COLLATE NOCASE`;

const ORDER_BY: Record<SortKey, SQL[]> = {
  title: [titleOrder],
  year: [sql`${movies.releaseYear} IS NULL`, desc(movies.releaseYear), titleOrder],
  added: [desc(movies.createdAt), desc(movies.id)],
  rating: [sql`${movies.rating} IS NULL`, desc(movies.rating), titleOrder],
};

export async function listMovies(query: Omit<CollectionQuery, "layout">): Promise<MovieWithCopies[]> {
  const { q, view, format, genre, status, decade, sort } = query;
  const hasCopy = (cond: SQL) =>
    exists(db.select({ one: sql`1` }).from(copies).where(and(eq(copies.movieId, movies.id), cond)));

  return db.query.movies.findMany({
    where: and(
      eq(movies.isWishlist, view === "wishlist"),
      q ? or(contains(movies.title, q), contains(movies.director, q), contains(movies.cast, q)) : undefined,
      format === DIGITAL_FILTER
        ? hasCopy(sql`${copies.format} LIKE 'Digital%'`)
        : format
          ? hasCopy(eq(copies.format, format))
          : undefined,
      genre
        ? sql`EXISTS (SELECT 1 FROM json_each(${movies.genres}) WHERE json_each.value = ${genre} COLLATE NOCASE)`
        : undefined,
      status ? eq(movies.watchStatus, status) : undefined,
      decade ? between(movies.releaseYear, decade, decade + 9) : undefined,
    ),
    with: { copies: { orderBy: copies.id } },
    orderBy: ORDER_BY[sort],
  });
}

/**
 * A movie already in the collection that is the same film: same TMDB id, or
 * same title (case-insensitive) with a matching or unknown release year.
 */
export function findExistingFilm(title: string, releaseYear: number | null, tmdbId: number | null) {
  return db
    .select({ id: movies.id, title: movies.title, isWishlist: movies.isWishlist })
    .from(movies)
    .where(
      or(
        tmdbId == null ? undefined : eq(movies.tmdbId, tmdbId),
        and(
          sql`${movies.title} = ${title} COLLATE NOCASE`,
          releaseYear == null
            ? undefined
            : or(sql`${movies.releaseYear} IS NULL`, eq(movies.releaseYear, releaseYear)),
        ),
      ),
    )
    .get();
}

export type CollectionStats = {
  owned: number;
  wishlist: number;
  ownedCopies: number;
  watched: number;
  inProgress: number;
  /** Sum of recorded purchase prices (owned copies only), in cents. */
  spentCents: number;
  /** Copies that have a recorded price. */
  pricedCopies: number;
  /** Owned copies per format, largest first. */
  formats: { format: string; count: number }[];
};

export async function getCollectionStats(): Promise<CollectionStats> {
  const m = db
    .select({
      owned: sql<number>`COALESCE(SUM(${movies.isWishlist} = 0), 0)`,
      wishlist: sql<number>`COALESCE(SUM(${movies.isWishlist} = 1), 0)`,
      watched: sql<number>`COALESCE(SUM(${movies.isWishlist} = 0 AND ${movies.watchStatus} = 'watched'), 0)`,
      inProgress: sql<number>`COALESCE(SUM(${movies.isWishlist} = 0 AND ${movies.watchStatus} = 'in_progress'), 0)`,
    })
    .from(movies)
    .get()!;
  const c = db
    .select({
      copies: count(),
      spent: sql<number>`COALESCE(SUM(${copies.priceCents}), 0)`,
      priced: count(copies.priceCents),
    })
    .from(copies)
    .innerJoin(movies, eq(movies.id, copies.movieId))
    .where(eq(movies.isWishlist, false))
    .get()!;
  const formats = db
    .select({ format: copies.format, count: count() })
    .from(copies)
    .innerJoin(movies, eq(movies.id, copies.movieId))
    .where(eq(movies.isWishlist, false))
    .groupBy(copies.format)
    .orderBy(desc(count()), copies.format)
    .all();
  return {
    owned: m.owned,
    wishlist: m.wishlist,
    ownedCopies: c.copies,
    watched: m.watched,
    inProgress: m.inProgress,
    spentCents: c.spent,
    pricedCopies: c.priced,
    formats,
  };
}

/** Distinct values present in the collection, for the filter dropdowns. */
export async function getFilterOptions(view: CollectionQuery["view"]) {
  const wishlist = view === "wishlist" ? 1 : 0;
  const genres = db.all<{ genre: string }>(sql`
    SELECT DISTINCT j.value AS genre
    FROM ${movies}, json_each(${movies.genres}) AS j
    WHERE ${movies.isWishlist} = ${wishlist}
    ORDER BY j.value COLLATE NOCASE`);
  const decades = db.all<{ decade: number }>(sql`
    SELECT DISTINCT (${movies.releaseYear} / 10) * 10 AS decade
    FROM ${movies}
    WHERE ${movies.isWishlist} = ${wishlist} AND ${movies.releaseYear} IS NOT NULL
    ORDER BY decade DESC`);
  const formats = db
    .selectDistinct({ format: copies.format })
    .from(copies)
    .innerJoin(movies, eq(movies.id, copies.movieId))
    .where(eq(movies.isWishlist, view === "wishlist"))
    .all();
  return {
    genres: genres.map((r) => r.genre),
    decades: decades.map((r) => r.decade),
    formats: formats.map((r) => r.format),
  };
}

/** Highest-rated owned movies (unrated ones excluded), ties broken by title. */
export async function getTopRated(limit = 10): Promise<MovieWithCopies[]> {
  return db.query.movies.findMany({
    where: and(eq(movies.isWishlist, false), sql`${movies.rating} IS NOT NULL`),
    with: { copies: { orderBy: copies.id } },
    orderBy: [desc(movies.rating), titleOrder],
    limit,
  });
}

export async function getMovie(id: number): Promise<MovieWithCopies | undefined> {
  return db.query.movies.findFirst({
    where: eq(movies.id, id),
    with: { copies: { orderBy: copies.id } },
  });
}

export async function getCollectionCounts() {
  const rows = await db
    .select({ isWishlist: movies.isWishlist, n: count() })
    .from(movies)
    .groupBy(movies.isWishlist);
  return {
    owned: rows.find((r) => !r.isWishlist)?.n ?? 0,
    wishlist: rows.find((r) => r.isWishlist)?.n ?? 0,
  };
}

export type DuplicateMatch = {
  movieId: number;
  title: string;
  releaseYear: number | null;
  format: string;
  isWishlist: boolean;
};

/**
 * Existing movies that are the same film (same title, case-insensitive, or the
 * same TMDB id) and already have one of the given formats. Used to warn before
 * saving a likely duplicate.
 */
export async function findDuplicates(
  { title, tmdbId }: { title: string; tmdbId: number | null },
  formats: string[],
  excludeMovieId?: number,
): Promise<DuplicateMatch[]> {
  if (formats.length === 0) return [];
  return db
    .selectDistinct({
      movieId: movies.id,
      title: movies.title,
      releaseYear: movies.releaseYear,
      format: copies.format,
      isWishlist: movies.isWishlist,
    })
    .from(movies)
    .innerJoin(copies, eq(copies.movieId, movies.id))
    .where(
      and(
        or(
          sql`${movies.title} = ${title.trim()} COLLATE NOCASE`,
          tmdbId == null ? undefined : eq(movies.tmdbId, tmdbId),
        ),
        inArray(copies.format, formats),
        excludeMovieId === undefined ? undefined : ne(movies.id, excludeMovieId),
      ),
    );
}
