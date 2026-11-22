"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { copies, movies } from "@/db/schema";
import { deletePosterIfUnused } from "@/lib/poster-cleanup";
import { cachePoster } from "@/lib/posters";
import { findDuplicates, getMovie, type DuplicateMatch } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { backupIfDue, createBackup } from "@/lib/backup";
import {
  copySchema,
  movieInputSchema,
  toFieldErrors,
  type CopyInput,
  type FieldErrors,
  type MovieInput,
} from "@/lib/validation";

export type MovieFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: FieldErrors }
  | { status: "duplicate"; duplicates: DuplicateMatch[] };

type Parsed = { ok: true; data: MovieInput; confirmDuplicate: boolean } | { ok: false; state: MovieFormState };

/** The client form posts its whole state as JSON in a single `payload` field. */
function parseForm(formData: FormData): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, state: { status: "error", message: "Invalid form submission.", fieldErrors: {} } };
  }
  const result = movieInputSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      state: { status: "error", message: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(result.error) },
    };
  }
  return { ok: true, data: result.data, confirmDuplicate: formData.get("confirmDuplicate") === "1" };
}

function movieValues(m: MovieInput, posterUrl: string | null) {
  return {
    tmdbId: m.tmdbId,
    title: m.title,
    releaseYear: m.releaseYear,
    director: m.director,
    cast: m.cast,
    genres: m.genres,
    posterUrl,
    synopsis: m.synopsis,
    runtime: m.runtime,
    isWishlist: m.isWishlist,
    watchStatus: m.watchStatus,
    rating: m.rating,
    notes: m.notes,
    tags: m.tags,
    tmdbCollectionId: m.tmdbCollectionId,
    tmdbCollectionName: m.tmdbCollectionName,
  };
}

function copyRow(movieId: number, c: CopyInput) {
  return {
    movieId,
    format: c.format,
    edition: c.edition,
    purchaseDate: c.purchaseDate,
    priceCents: c.price,
    condition: c.condition,
    location: c.location,
    loanedTo: c.loanedTo,
    loanedOn: c.loanedOn,
    upc: c.upc,
  };
}

function copyValues(movieId: number, m: MovieInput) {
  return m.copies.map((c) => copyRow(movieId, c));
}

async function duplicateCheck(m: MovieInput, formats: string[], excludeId?: number): Promise<MovieFormState | null> {
  const duplicates = await findDuplicates(m, formats, excludeId);
  return duplicates.length ? { status: "duplicate", duplicates } : null;
}

/**
 * Formats to duplicate-check on edit: only ones newly added, unless the film's
 * identity (title / TMDB id) changed. Otherwise a duplicate the user already
 * confirmed would re-warn on every later edit.
 */
function formatsToCheckOnEdit(existing: { title: string; tmdbId: number | null; copies: { format: string }[] }, m: MovieInput) {
  const formats = m.copies.map((c) => c.format);
  const sameFilm = existing.title.toLowerCase() === m.title.toLowerCase() && existing.tmdbId === m.tmdbId;
  if (!sameFilm) return formats;
  const had = new Set(existing.copies.map((c) => c.format));
  return formats.filter((f) => !had.has(f));
}

export async function createMovie(_prev: MovieFormState, formData: FormData): Promise<MovieFormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data, confirmDuplicate } = parsed;

  if (!confirmDuplicate) {
    const dup = await duplicateCheck(data, data.copies.map((c) => c.format));
    if (dup) return dup;
  }

  // Cache remote posters locally so the collection works offline.
  const posterUrl = await cachePoster(data.posterUrl);

  await backupIfDue();
  const id = db.transaction((tx) => {
    const row = tx
      .insert(movies)
      .values({ ...movieValues(data, posterUrl), userId: user.id })
      .returning({ id: movies.id })
      .get();
    if (data.copies.length) tx.insert(copies).values(copyValues(row.id, data)).run();
    return row.id;
  });

  revalidatePath("/", "layout");
  redirect(`/movies/${id}`);
}

export async function updateMovie(
  id: number,
  _prev: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data, confirmDuplicate } = parsed;

  const existing = await getMovie(id);
  if (!existing) {
    return { status: "error", message: "This movie no longer exists.", fieldErrors: {} };
  }

  if (!confirmDuplicate) {
    const dup = await duplicateCheck(data, formatsToCheckOnEdit(existing, data), id);
    if (dup) return dup;
  }

  const posterUrl = await cachePoster(data.posterUrl);

  await backupIfDue();
  db.transaction((tx) => {
    tx.update(movies)
      .set({ ...movieValues(data, posterUrl), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(movies.id, id))
      .run();
    // Copies have no identity outside their movie, so replace the set wholesale.
    tx.delete(copies).where(eq(copies.movieId, id)).run();
    if (data.copies.length) tx.insert(copies).values(copyValues(id, data)).run();
  });

  if (existing.posterUrl !== posterUrl) await deletePosterIfUnused(existing.posterUrl);

  revalidatePath("/", "layout");
  redirect(`/movies/${id}`);
}

export async function deleteMovie(id: number): Promise<void> {
  await backupIfDue();
  const deleted = db
    .delete(movies)
    .where(eq(movies.id, id))
    .returning({ posterUrl: movies.posterUrl })
    .get();
  if (deleted) await deletePosterIfUnused(deleted.posterUrl);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Wishlist → Owned in one step. The posted copy (what was actually bought)
 * replaces the wishlist's "wanted formats"; the movie's other fields are kept.
 */
export async function markPurchased(
  id: number,
  _prev: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { status: "error", message: "Invalid form submission.", fieldErrors: {} };
  }
  const result = copySchema.safeParse(raw);
  if (!result.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(result.error) };
  }
  const copy = result.data;

  const existing = await getMovie(id);
  if (!existing) return { status: "error", message: "This movie no longer exists.", fieldErrors: {} };
  if (!existing.isWishlist) return { status: "error", message: "This movie is already owned.", fieldErrors: {} };

  if (formData.get("confirmDuplicate") !== "1") {
    const duplicates = await findDuplicates(existing, [copy.format], id);
    if (duplicates.length) return { status: "duplicate", duplicates };
  }

  await backupIfDue();
  db.transaction((tx) => {
    tx.update(movies)
      .set({ isWishlist: false, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(movies.id, id))
      .run();
    tx.delete(copies).where(eq(copies.movieId, id)).run();
    tx.insert(copies).values(copyRow(id, copy)).run();
  });

  revalidatePath("/", "layout");
  redirect(`/movies/${id}`);
}

export type BackupResult = { ok: true; file: string } | { ok: false; message: string };

/** "Back up now" on the Import & export page. */
export async function backupNow(): Promise<BackupResult> {
  try {
    const { file } = await createBackup("manual");
    revalidatePath("/data");
    return { ok: true, file };
  } catch (err) {
    console.error("Manual backup failed:", err);
    return { ok: false, message: "Backup failed. Check the server log for details." };
  }
}
