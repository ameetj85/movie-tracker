"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { movies, viewings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { backupIfDue } from "@/lib/backup";
import { WATCH_STATUSES } from "@/lib/constants";
import { deletePosterIfUnused } from "@/lib/poster-cleanup";
import { cachePoster } from "@/lib/posters";
import { getMovie } from "@/lib/queries";
import { getTmdbMovie, isTmdbConfigured, TmdbError } from "@/lib/tmdb";
import { syncMovieFromTmdb } from "@/lib/tmdb-sync";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const fail = (message: string): ActionResult => ({ ok: false, message });

function refresh(movieId?: number) {
  revalidatePath("/", "layout");
  if (movieId) revalidatePath(`/movies/${movieId}`);
}

// ---------------------------------------------------------------- Watch history

const viewingSchema = z.object({
  watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
});

/** Log a viewing; also marks the movie as watched. */
export async function logViewing(movieId: number, input: { watchedOn: string; note: string }): Promise<ActionResult> {
  const parsed = viewingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid viewing.");
  if (!(await getMovie(movieId))) return fail("This movie no longer exists.");
  await backupIfDue();
  db.transaction((tx) => {
    tx.insert(viewings).values({ movieId, ...parsed.data }).run();
    tx.update(movies)
      .set({ watchStatus: "watched", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(movies.id, movieId))
      .run();
  });
  refresh(movieId);
  return { ok: true };
}

export async function deleteViewing(viewingId: number): Promise<ActionResult> {
  await backupIfDue();
  const row = db.delete(viewings).where(eq(viewings.id, viewingId)).returning({ movieId: viewings.movieId }).get();
  if (!row) return fail("That viewing was already removed.");
  refresh(row.movieId);
  return { ok: true };
}

// ---------------------------------------------------------------- Bulk edit

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(5000),
  op: z.discriminatedUnion("type", [
    z.object({ type: z.literal("status"), status: z.enum(WATCH_STATUSES) }),
    z.object({ type: z.literal("addTag"), tag: z.string().trim().min(1).max(40) }),
    z.object({ type: z.literal("removeTag"), tag: z.string().trim().min(1).max(40) }),
    z.object({ type: z.literal("delete") }),
  ]),
});
export type BulkOp = z.input<typeof bulkSchema>["op"];

/** Apply one change to many movies at once (the collection page's select mode). */
export async function bulkUpdate(ids: number[], op: BulkOp): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse({ ids, op });
  if (!parsed.success) return fail("Invalid bulk change.");
  const { ids: targetIds, op: change } = parsed.data;
  await backupIfDue();

  const n = targetIds.length;
  const movieWord = `${n} movie${n === 1 ? "" : "s"}`;
  let message: string;

  if (change.type === "delete") {
    const deleted = db
      .delete(movies)
      .where(inArray(movies.id, targetIds))
      .returning({ posterUrl: movies.posterUrl })
      .all();
    for (const d of deleted) await deletePosterIfUnused(d.posterUrl);
    message = `Deleted ${deleted.length} movie${deleted.length === 1 ? "" : "s"}.`;
  } else if (change.type === "status") {
    db.update(movies)
      .set({ watchStatus: change.status, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(inArray(movies.id, targetIds))
      .run();
    message = `Updated ${movieWord}.`;
  } else {
    const rows = db.select({ id: movies.id, tags: movies.tags }).from(movies).where(inArray(movies.id, targetIds)).all();
    const want = change.tag.toLowerCase();
    db.transaction((tx) => {
      for (const r of rows) {
        const current = r.tags ?? [];
        const has = current.some((t) => t.toLowerCase() === want);
        const next =
          change.type === "addTag"
            ? has
              ? current
              : [...current, change.tag]
            : current.filter((t) => t.toLowerCase() !== want);
        if (next.length === current.length) continue;
        tx.update(movies)
          .set({ tags: next.length ? next : null, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(movies.id, r.id))
          .run();
      }
    });
    message = change.type === "addTag" ? `Tagged ${movieWord} “${change.tag}”.` : `Removed “${change.tag}” from ${movieWord}.`;
  }

  refresh();
  return { ok: true, message };
}

// ---------------------------------------------------------------- TMDB

function tmdbError(e: unknown): ActionResult {
  return fail(e instanceof TmdbError ? e.message : "TMDB request failed.");
}

/** "Refresh from TMDB" on a movie's page: overwrite its metadata with TMDB's. */
export async function refreshMovieFromTmdb(movieId: number): Promise<ActionResult> {
  if (!isTmdbConfigured()) return fail("TMDB isn't configured.");
  const movie = await getMovie(movieId);
  if (!movie) return fail("This movie no longer exists.");
  await backupIfDue();
  try {
    const outcome = await syncMovieFromTmdb(movie, "overwrite");
    refresh(movieId);
    if (outcome === "unmatched") return fail(`Couldn't find “${movie.title}” on TMDB. Edit it and use “Find on TMDB”.`);
    return { ok: true, message: outcome === "updated" ? "Updated from TMDB." : "Already up to date." };
  } catch (e) {
    return tmdbError(e);
  }
}

/** Franchise page: add a film you don't have to the wishlist, filled in from TMDB. */
export async function addToWishlistFromTmdb(tmdbId: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!isTmdbConfigured()) return fail("TMDB isn't configured.");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return fail("Invalid TMDB id.");
  const existing = db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId)).get();
  if (existing) return fail("That movie is already in your vault.");
  try {
    const d = await getTmdbMovie(tmdbId);
    const posterUrl = await cachePoster(d.posterUrl);
    await backupIfDue();
    db.insert(movies)
      .values({
        tmdbId: d.tmdbId,
        title: d.title,
        releaseYear: d.releaseYear,
        director: d.director,
        cast: d.cast,
        genres: d.genres.length ? d.genres : null,
        synopsis: d.synopsis,
        runtime: d.runtime,
        posterUrl,
        isWishlist: true,
        userId: user.id,
        tmdbCollectionId: d.collection?.id ?? null,
        tmdbCollectionName: d.collection?.name ?? null,
      })
      .run();
    refresh();
    return { ok: true, message: `Added “${d.title}” to your wishlist.` };
  } catch (e) {
    return tmdbError(e);
  }
}
