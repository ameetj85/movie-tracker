import "server-only";

import { and, between, count, desc, eq, exists, inArray, isNotNull, ne, not, or, sql, type SQL } from "drizzle-orm";

import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { copies, movies, viewings, type MovieWithCopies, type Viewing } from "@/db/schema";
import {
  DIGITAL_FILTER,
  LOANED_FILTER,
  LOW_DEF_FORMATS,
  UPGRADE_FILTER,
  type CollectionQuery,
  type SortKey,
} from "@/lib/collection-params";

/** Case-insensitive substring match with LIKE wildcards in the term escaped. */
function contains(column: AnySQLiteColumn, term: string): SQL {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

const titleOrder = sql`${movies.title} COLLATE NOCASE`;

/**
 * Most recent logged viewing (null if never logged). The subquery's own columns
 * are written as plain SQL: inside `db.query` (relational queries) Drizzle
 * re-qualifies interpolated columns with the main table's alias, which would
 * turn `viewings.watched_on` into `movies.watched_on`.
 */
const lastWatched = sql`(SELECT MAX(v.watched_on) FROM viewings v WHERE v.movie_id = ${movies.id})`;

const ORDER_BY: Record<SortKey, SQL[]> = {
  title: [titleOrder],
  year: [sql`${movies.releaseYear} IS NULL`, desc(movies.releaseYear), titleOrder],
  added: [desc(movies.createdAt), desc(movies.id)],
  rating: [sql`${movies.rating} IS NULL`, desc(movies.rating), titleOrder],
  watched: [sql`${lastWatched} IS NULL`, sql`${lastWatched} DESC`, titleOrder],
};

type ListQuery = Omit<CollectionQuery, "layout" | "show">;

const hasCopy = (cond: SQL) =>
  exists(db.select({ one: sql`1` }).from(copies).where(and(eq(copies.movieId, movies.id), cond)));

/** JSON string-array column contains `value` (case-insensitive). */
const jsonHas = (column: AnySQLiteColumn, value: string) =>
  sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE json_each.value = ${value} COLLATE NOCASE)`;

/** The collection page's search + filters as one WHERE clause. */
function collectionWhere(query: ListQuery): SQL | undefined {
  const { q, view, format, genre, status, decade, location, tag } = query;
  const lowDef = sql.join(
    LOW_DEF_FORMATS.map((f) => sql`${f}`),
    sql`, `,
  );
  return and(
    eq(movies.isWishlist, view === "wishlist"),
    q
      ? or(contains(movies.title, q), contains(movies.director, q), contains(movies.cast, q), contains(movies.tags, q))
      : undefined,
    format === DIGITAL_FILTER
      ? hasCopy(sql`${copies.format} LIKE 'Digital%'`)
      : format === UPGRADE_FILTER
        ? // Has a DVD/VHS copy and nothing better (Blu-ray, 4K, digital, file).
          and(hasCopy(sql`${copies.format} IN (${lowDef})`), not(hasCopy(sql`${copies.format} NOT IN (${lowDef})`)))
        : format
          ? hasCopy(eq(copies.format, format))
          : undefined,
    genre ? jsonHas(movies.genres, genre) : undefined,
    tag ? jsonHas(movies.tags, tag) : undefined,
    status ? eq(movies.watchStatus, status) : undefined,
    decade ? between(movies.releaseYear, decade, decade + 9) : undefined,
    location === LOANED_FILTER
      ? hasCopy(isNotNull(copies.loanedTo))
      : location
        ? hasCopy(sql`${copies.location} = ${location} COLLATE NOCASE`)
        : undefined,
  );
}

/** Movies matching the collection query; `limit` caps how many are loaded (pagination). */
export async function listMovies(query: ListQuery, limit?: number): Promise<MovieWithCopies[]> {
  return db.query.movies.findMany({
    where: collectionWhere(query),
    with: { copies: { orderBy: copies.id } },
    orderBy: ORDER_BY[query.sort],
    limit,
  });
}

/** How many movies match the collection query (for "Showing N of M"). */
export async function countMovies(query: ListQuery): Promise<number> {
  return db.select({ n: count() }).from(movies).where(collectionWhere(query)).get()?.n ?? 0;
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
    .select({ copies: count() })
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
  // Locations and loans only apply to copies you own.
  const locations =
    view === "owned"
      ? db.all<{ location: string }>(sql`
          SELECT DISTINCT ${copies.location} AS location
          FROM ${copies} JOIN ${movies} ON ${movies.id} = ${copies.movieId}
          WHERE ${movies.isWishlist} = 0 AND ${copies.location} IS NOT NULL
          ORDER BY ${copies.location} COLLATE NOCASE`)
      : [];
  const anyLoaned =
    view === "owned" &&
    !!db.get(sql`
      SELECT 1 FROM ${copies} JOIN ${movies} ON ${movies.id} = ${copies.movieId}
      WHERE ${movies.isWishlist} = 0 AND ${copies.loanedTo} IS NOT NULL LIMIT 1`);
  const tags = db.all<{ tag: string }>(sql`
    SELECT MIN(j.value) AS tag
    FROM ${movies}, json_each(${movies.tags}) AS j
    WHERE ${movies.isWishlist} = ${wishlist}
    GROUP BY j.value COLLATE NOCASE
    ORDER BY tag COLLATE NOCASE`);
  const anyUpgrade =
    view === "owned" &&
    (await countMovies({
      view,
      q: "",
      format: UPGRADE_FILTER,
      genre: null,
      status: null,
      decade: null,
      location: null,
      tag: null,
      sort: "title",
    })) > 0;
  return {
    genres: genres.map((r) => r.genre),
    decades: decades.map((r) => r.decade),
    formats: formats.map((r) => r.format),
    locations: locations.map((r) => r.location),
    anyLoaned,
    tags: tags.map((r) => r.tag),
    anyUpgrade,
  };
}

/** Every tag in use (owned and wishlist), for the form's suggestions. */
export async function getAllTags(): Promise<string[]> {
  return db
    .all<{ tag: string }>(sql`
      SELECT MIN(j.value) AS tag FROM ${movies}, json_each(${movies.tags}) AS j
      GROUP BY j.value COLLATE NOCASE
      ORDER BY tag COLLATE NOCASE`)
    .map((r) => r.tag);
}

/** A movie's watch history, newest first. */
export async function getViewings(movieId: number): Promise<Viewing[]> {
  return db.select().from(viewings).where(eq(viewings.movieId, movieId)).orderBy(desc(viewings.watchedOn), desc(viewings.id)).all();
}

/** Viewings logged in a calendar year (for the Watched stat). */
export async function countViewingsInYear(year: number): Promise<number> {
  return (
    db
      .select({ n: count() })
      .from(viewings)
      .where(between(viewings.watchedOn, `${year}-01-01`, `${year}-12-31`))
      .get()?.n ?? 0
  );
}

export type FranchiseSummary = { id: number; name: string; owned: number; wishlist: number };

/** Franchises (TMDB collections) with at least one movie in the vault. */
export async function listFranchises(): Promise<FranchiseSummary[]> {
  return db
    .select({
      id: sql<number>`${movies.tmdbCollectionId}`,
      name: sql<string>`MAX(${movies.tmdbCollectionName})`,
      owned: sql<number>`SUM(${movies.isWishlist} = 0)`,
      wishlist: sql<number>`SUM(${movies.isWishlist} = 1)`,
    })
    .from(movies)
    .where(isNotNull(movies.tmdbCollectionId))
    .groupBy(movies.tmdbCollectionId)
    .orderBy(sql`MAX(${movies.tmdbCollectionName}) COLLATE NOCASE`)
    .all();
}

/** Vault movies in one franchise, keyed by TMDB id for matching against the TMDB part list. */
export async function getFranchiseMovies(collectionId: number) {
  return db
    .select({ id: movies.id, tmdbId: movies.tmdbId, title: movies.title, isWishlist: movies.isWishlist })
    .from(movies)
    .where(eq(movies.tmdbCollectionId, collectionId))
    .all();
}

/** Copies already carrying this barcode (to warn before adding it twice). */
export async function findByUpc(upc: string) {
  return db
    .select({ movieId: movies.id, title: movies.title, format: copies.format, isWishlist: movies.isWishlist })
    .from(copies)
    .innerJoin(movies, eq(movies.id, copies.movieId))
    .where(eq(copies.upc, upc))
    .all();
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
