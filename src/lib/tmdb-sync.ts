import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { movies, type Movie } from "@/db/schema";
import { matchTmdb } from "@/lib/import";
import { deletePosterIfUnused } from "@/lib/poster-cleanup";
import { cachePoster, isLocalPoster } from "@/lib/posters";
import { getTmdbMovie } from "@/lib/tmdb";

/**
 * - "overwrite": replace the metadata with TMDB's (title, year, director, cast,
 *   genres, synopsis, runtime, poster, franchise), like picking the film in the
 *   form's TMDB search. Personal fields and copies are never touched.
 * - "fill": only fill blanks (and the franchise), never overwriting your edits.
 */
export type SyncMode = "overwrite" | "fill";
export type SyncOutcome = "updated" | "unchanged" | "unmatched";

/** Refresh one movie from TMDB, matching it by title + year first if it has no TMDB id. */
export async function syncMovieFromTmdb(movie: Movie, mode: SyncMode): Promise<SyncOutcome> {
  const tmdbId = movie.tmdbId ?? (await matchTmdb(movie.title, movie.releaseYear));
  if (!tmdbId) return "unmatched";
  const d = await getTmdbMovie(tmdbId);

  const keep = <T>(current: T | null, fresh: T | null): T | null =>
    mode === "overwrite" ? (fresh ?? current) : (current ?? fresh);

  // Poster: overwrite takes TMDB's. Fill adds TMDB's when there is none, and
  // retries caching one that's still a remote URL (an earlier download failed).
  let source: string | null = null;
  if (mode === "overwrite") source = d.posterUrl;
  else if (!movie.posterUrl) source = d.posterUrl;
  else if (!isLocalPoster(movie.posterUrl)) source = movie.posterUrl;
  const posterUrl = source ? await cachePoster(source) : movie.posterUrl;

  const next = {
    tmdbId,
    title: mode === "overwrite" ? d.title : movie.title,
    releaseYear: keep(movie.releaseYear, d.releaseYear),
    director: keep(movie.director, d.director),
    cast: keep(movie.cast, d.cast),
    genres: keep(movie.genres, d.genres.length ? d.genres : null),
    synopsis: keep(movie.synopsis, d.synopsis),
    runtime: keep(movie.runtime, d.runtime),
    posterUrl,
    tmdbCollectionId: d.collection?.id ?? (mode === "overwrite" ? null : movie.tmdbCollectionId),
    tmdbCollectionName: d.collection?.name ?? (mode === "overwrite" ? null : movie.tmdbCollectionName),
  };

  const changed = (Object.keys(next) as (keyof typeof next)[]).some(
    (k) => JSON.stringify(next[k]) !== JSON.stringify(movie[k]),
  );
  if (!changed) return "unchanged";

  db.update(movies)
    .set({ ...next, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(movies.id, movie.id))
    .run();
  if (movie.posterUrl !== posterUrl) await deletePosterIfUnused(movie.posterUrl);
  return "updated";
}
