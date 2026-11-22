import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Relative import: drizzle-kit loads this file outside Next and doesn't resolve "@/".
import { WATCH_STATUSES } from "../lib/constants";

/**
 * A movie title in the collection (owned or wishlisted).
 * Per-copy ownership details (format, edition, purchase info) live in `copies`,
 * so one movie can be owned in several formats without duplicating metadata.
 */
export const movies = sqliteTable(
  "movies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tmdbId: integer("tmdb_id"),
    title: text("title").notNull(),
    releaseYear: integer("release_year"),
    director: text("director"),
    /** Comma-separated list of principal cast members. */
    cast: text("cast"),
    /** JSON-encoded string array, e.g. ["Action","Sci-Fi"]. */
    genres: text("genres", { mode: "json" }).$type<string[]>(),
    posterUrl: text("poster_url"),
    synopsis: text("synopsis"),
    /** Runtime in minutes. */
    runtime: integer("runtime"),
    isWishlist: integer("is_wishlist", { mode: "boolean" })
      .notNull()
      .default(false),
    watchStatus: text("watch_status", { enum: WATCH_STATUSES })
      .notNull()
      .default("unwatched"),
    /** Personal rating on a 1–10 scale. */
    rating: integer("rating"),
    notes: text("notes"),
    /** Personal labels, JSON-encoded string array, e.g. ["Christmas","Kids"]. */
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    /** TMDB collection (franchise) this film belongs to, e.g. 87359 "Mission: Impossible Collection". */
    tmdbCollectionId: integer("tmdb_collection_id"),
    tmdbCollectionName: text("tmdb_collection_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("movies_title_idx").on(t.title),
    index("movies_is_wishlist_idx").on(t.isWishlist),
    index("movies_tmdb_collection_idx").on(t.tmdbCollectionId),
  ],
);

/** One physical or digital copy of a movie. */
export const copies = sqliteTable(
  "copies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    format: text("format").notNull(),
    edition: text("edition"),
    /** ISO date string (YYYY-MM-DD). */
    purchaseDate: text("purchase_date"),
    /** Price paid, stored in cents to avoid floating point issues. */
    priceCents: integer("price_cents"),
    condition: text("condition"),
    /** Where this copy lives, e.g. "Shelf B3" (free text). */
    location: text("location"),
    /** Who this copy is lent to; null when it's at home. */
    loanedTo: text("loaned_to"),
    /** ISO date (YYYY-MM-DD) the loan started. Only set while loanedTo is. */
    loanedOn: text("loaned_on"),
    /** Barcode (UPC/EAN digits) of this disc, when added by scanning. */
    upc: text("upc"),
  },
  (t) => [index("copies_movie_id_idx").on(t.movieId), index("copies_upc_idx").on(t.upc)],
);

/** One time a movie was watched (watch history / diary). */
export const viewings = sqliteTable(
  "viewings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    /** ISO date (YYYY-MM-DD). */
    watchedOn: text("watched_on").notNull(),
    note: text("note"),
  },
  (t) => [index("viewings_movie_id_idx").on(t.movieId), index("viewings_watched_on_idx").on(t.watchedOn)],
);

export const moviesRelations = relations(movies, ({ many }) => ({
  copies: many(copies),
  viewings: many(viewings),
}));

export const copiesRelations = relations(copies, ({ one }) => ({
  movie: one(movies, { fields: [copies.movieId], references: [movies.id] }),
}));

export const viewingsRelations = relations(viewings, ({ one }) => ({
  movie: one(movies, { fields: [viewings.movieId], references: [movies.id] }),
}));

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Copy = typeof copies.$inferSelect;
export type NewCopy = typeof copies.$inferInsert;
export type MovieWithCopies = Movie & { copies: Copy[] };
export type Viewing = typeof viewings.$inferSelect;
