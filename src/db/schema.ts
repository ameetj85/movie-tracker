import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
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
    /**
     * The account that added this movie. Nullable for rows from before accounts
     * existed; deleting a user keeps their movies (set to null) rather than losing them.
     * Reads are not scoped by owner yet: every signed-in user sees every movie.
     */
    userId: integer("user_id").references((): AnySQLiteColumn => users.id, { onDelete: "set null" }),
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
    index("movies_user_id_idx").on(t.userId),
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

/**
 * A person who can sign in. Not linked to `movies` yet: the collection is still
 * shared by every signed-in user.
 *
 * Timestamps set by the app (`lastLoginAt`, `lockedUntil`, ...) are ISO 8601 strings
 * from `Date#toISOString()`; `createdAt`/`updatedAt` use SQLite's CURRENT_TIMESTAMP
 * like the other tables.
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Stored trimmed and lower-cased, so lookups are case-insensitive. */
    email: text("email").notNull(),
    /** Display name shown in the header. */
    name: text("name"),
    /** Administrator flag. Not enforced anywhere yet. */
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    /** scrypt hash in the self-describing format produced by `hashPassword()`. */
    passwordHash: text("password_hash").notNull(),
    /** Set once the address is proven to work (currently: by completing a password reset). */
    emailVerifiedAt: text("email_verified_at"),
    lastLoginAt: text("last_login_at"),
    passwordChangedAt: text("password_changed_at"),
    /** Consecutive failed sign-ins; reset on success. */
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    /** Sign-in is refused until this time after too many failures. */
    lockedUntil: text("locked_until"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * A signed-in browser. The cookie holds a random token; only its SHA-256 hash is
 * stored here, so a leaked database can't be used to hijack sessions.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 (hex) of the session token in the cookie. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId), index("sessions_expires_at_idx").on(t.expiresAt)],
);

/** A single-use password reset link sent by email. Only the token's hash is stored. */
export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 (hex) of the token in the emailed link. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    /** Set when the token is redeemed (or superseded); a used token never works again. */
    usedAt: text("used_at"),
    /** IP address that asked for the reset, for auditing. */
    requestedIp: text("requested_ip"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_hash_idx").on(t.tokenHash),
    index("password_reset_tokens_user_id_idx").on(t.userId),
  ],
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
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
