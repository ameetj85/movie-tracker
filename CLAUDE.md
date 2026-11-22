# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project status

"Movie Vault": a local-first tracker for a personal collection of owned and wishlisted movies. The product spec is `FUNCTIONAL-REQ.mc` (Markdown, despite the extension). It defines three phases:

- **Phase 1 (MVP): done.** Manual CRUD, owned/wishlist split, title/director/cast search, duplicate warnings.
- **Phase 2: done.** TMDB auto-fill, offline poster cache, colored format badges, filters (format, genre, status, decade), sorting, grid/list toggle.
- **Phase 3: done.** Stats header on the collection page, CSV/JSON export, and CSV import with preview and optional TMDB enrichment (`/data`).
- **Beyond the spec:**
  - Top-10-rated carousel.
  - Light/dark theme.
  - "Mark as purchased" (wishlist → owned).
  - Per-copy shelf location and loans.
  - "Surprise me" random pick (`GET /api/random`, honours the current filters; unwatched only unless a status filter is set).
  - Automatic database backups.
  - **Franchises** (`/franchises`): TMDB "collections". `movies.tmdb_collection_id/name` is set from TMDB details (form, import enrichment, refresh). The detail page fetches the full part list from TMDB, and missing films can be added to the wishlist.
  - **Upgrade finder:** `format=@upgrade` means owned only on DVD/VHS (`LOW_DEF_FORMATS`).
  - **Watch history:** a `viewings` table. Logging a viewing sets `watch_status=watched`. Sort `watched` orders by the latest viewing. The JSON export includes viewings; the CSV doesn't.
  - **Barcodes:** `copies.upc`.
    - `GET /api/upc?code=` looks up UPCitemdb's free trial endpoint (~100/day, no key; only the digits are sent) in `src/lib/upc.ts`.
    - `src/lib/upc-title.ts` cleans product titles ("Mill Creek - Fight Club [BLU-RAY]" → "Fight Club") and guesses the format.
    - Camera scanning uses `BarcodeDetector` where the browser has it (needs a secure origin; localhost counts).
  - **Tags:** `movies.tags` JSON array, matched case-insensitively. There's a `tag` filter, and tags are searched by `q`. Suggestions come from `<TagSuggestions>` (a streamed `<datalist>`).
  - **Bulk edit:** "Select" mode in `src/components/collection-results.tsx` calls `bulkUpdate()`.
  - **TMDB refresh:**
    - On a movie's page it overwrites metadata.
    - `POST /api/tmdb/refresh` (Import & export page) only fills blanks for every movie, streaming NDJSON.
    - Both go through `syncMovieFromTmdb()` in `src/lib/tmdb-sync.ts`.
  - **Pagination:** `PAGE_SIZE` (60) per page via the `show` param ("Show more"). Changing any filter resets it.

## Environment

`.env.local` (gitignored) holds `TMDB_READ_ACCESS_TOKEN` (v4 token, preferred, sent as a Bearer header) and/or `TMDB_API_KEY` (v3 key, fallback). Without either, the TMDB panel is hidden and manual entry still works. Optional overrides: `DATABASE_PATH` (default `movies.db`), `POSTER_DIR` (default `data/posters`), and for backups `BACKUP_DIR` (default `data/backups`), `BACKUP_KEEP` (default 14) and `BACKUP_INTERVAL_HOURS` (default 24). The add page is prerendered, so whether TMDB is enabled is decided at build time.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build; also type-checks
- `npm run lint` — ESLint 9 flat config (`eslint.config.mjs`, extends `eslint-config-next` core-web-vitals + typescript)
- `npx tsc --noEmit` — type-check only. After adding or renaming routes, run `npx next typegen` first, or `PageProps<"/new/route">` fails to type-check.
- `npm run db:generate` — after editing `src/db/schema.ts`, generate a SQL migration into `drizzle/` (commit it)
- `npm run db:studio` — browse the database
- `npx shadcn@latest add <component>` — add a shadcn/ui component into `src/components/ui/`

- `npm test` — Vitest unit tests (`src/**/*.test.ts`). `npm run test:watch` runs them in watch mode.
  - Run through `scripts/vitest.mjs`, which upper-cases the Windows drive letter first. With a lowercase `c:\` working directory (common in VS Code terminals), Vitest loads two copies of itself and every test fails with "failed to find the current suite".
  - `test/setup.ts` points `DATABASE_PATH`, `POSTER_DIR` and `BACKUP_DIR` at a fresh temp folder and unsets the TMDB keys.
  - `server-only` is stubbed. Tests that call Server Actions mock `next/cache`.
  - `src/lib/round-trip.test.ts` guards the byte-identical CSV round trip.
- `npm run test:e2e` — Playwright tests in `e2e/`, run against the locally installed Edge (`PW_CHANNEL` to change it).
  - It runs `npm run build` and serves on port 3200 with a temp database and TMDB disabled. Afterwards, `.next` holds a build without TMDB, so rebuild before `npm start`.

## Data layer

- SQLite through **Drizzle ORM** and `better-sqlite3`, which is synchronous. `src/db/index.ts` opens a single connection (cached on `globalThis` across HMR) and **runs pending migrations from `drizzle/` automatically on first connection**, so `db:migrate` is rarely needed. The DB file is `movies.db` in the project root (gitignored). Override it with `DATABASE_PATH`.
  - `next build` workers open the DB too, so concurrent processes can race on a pending migration. `createDb()` retries `migrate()` once to absorb that.
  - The running dev server only migrates on its first connection, so restart it after adding a migration.
- The schema deliberately differs from the spec's single `movies` table. A **`movies`** row holds title-level data plus personal fields: `watch_status` is a 3-value enum (unwatched/in_progress/watched) instead of a boolean, `rating` is 1–10, there's an `is_wishlist` flag and a `cast` column, and `genres` is a JSON array. Each owned format is a **`copies`** row with `ON DELETE CASCADE`. This is how one movie can be owned in several formats.
  - A copy holds: format, edition, purchase date, `price_cents`, condition, `location`, `loaned_to`, `loaned_on`, `upc`.
  - Location and loans are per copy because they describe a physical item. `loaned_on` is cleared by validation when there's no borrower.
- **Backups** (`src/lib/backup.ts`) use SQLite's online backup API via `db.$client.backup()`.
  - Every mutating action calls `backupIfDue()` *before* writing. It snapshots at most once per interval, and a failed backup never blocks the save.
  - Imports always call `createBackup("pre-import")` first.
  - The `/data` page lists backups and has "Back up now".
- **Drizzle gotcha:** inside `db.query.*` (relational queries), Drizzle re-qualifies interpolated columns in `sql` with the main table's alias. A subquery on another table must use plain SQL identifiers (see `lastWatched` in `queries.ts`).
- Reads live in `src/lib/queries.ts` (`server-only`). Mutations live in `src/lib/actions.ts` and `src/lib/library-actions.ts` (Server Actions; the latter return `{ok, message}` instead of redirecting). After writing, each action calls `revalidatePath("/", "layout")` and redirects. Updates replace a movie's copies wholesale inside a transaction.
- Duplicate warning: a "duplicate" is the same film (same title case-insensitive, **or** the same `tmdb_id`) with the same format. Actions return `{status: "duplicate"}` unless the form was submitted with `confirmDuplicate=1` (the "Save anyway" button). On edit, only newly added formats are checked, unless the title or TMDB id changed.
- Collection page state lives entirely in URL params (`view`, `q`, `format`, `genre`, `status`, `decade`, `location`, `tag`, `sort`, `layout`, `show`). `location=@loaned` means "any copy on loan". `src/lib/collection-params.ts` parses them, silently dropping invalid values, and is shared by server and client. The `format=digital` filter matches any `Digital - …` format. The genre filter queries the JSON column with `json_each`. Filter dropdowns list only values present in the data (`getFilterOptions`).

## TMDB and posters

- `src/lib/tmdb.ts` (server-only) is the only code that talks to TMDB. The browser calls it through `GET /api/tmdb/search?q=` and `GET /api/tmdb/movie/[id]`. Selecting a result in `<TmdbSearch>` overwrites only the metadata fields in the form. Ownership and personal fields are kept.
- **Posters are cached for offline use.** The form keeps the remote TMDB URL. On save, `cachePoster()` in `src/lib/posters.ts` downloads any http(s) poster into `data/posters/<sha256>.<ext>` (gitignored) and stores `/posters/<file>` in the DB. If the download fails, the save still succeeds with the remote URL. The files are served by `src/app/posters/[file]/route.ts`, not from `public/`, because Next only serves `public/` files that existed at build time. When an update or delete leaves a cached poster unreferenced, the file is deleted.
- Posters render with a plain `<img>`, not `next/image` (`src/components/poster.tsx`).

## Import / export (Phase 3)

- **CSV layout** (`src/lib/csv-format.ts`, `CSV_COLUMNS`): one row per copy, with movie-level columns repeated on each row. A movie with no copies is one row with empty copy columns. Any change to the layout must keep export → import round-tripping to byte-identical output. `src/lib/round-trip.test.ts` and the e2e suite check this.
- **Export** (`GET /api/export?format=csv|json`, `src/lib/export.ts`): the CSV gets a BOM and CRLF line endings, and cells starting with `= + - @` get a leading `'` so spreadsheets don't run them as formulas. The importer strips that prefix again.
- **Import** (`POST /api/import`, `src/lib/import.ts`) is stateless and runs in two modes:
  - `preview` parses and validates, and returns a summary without writing anything.
  - `commit` re-parses, then streams NDJSON progress lines (`tmdb` → `posters` → `saving`) followed by a result. Everything is inserted in a single transaction.
- **How rows become movies:**
  - Header aliases cover common spreadsheet, Letterboxd and CLZ names. A `Letterboxd URI` column means ratings are doubled and rows are marked watched.
  - Format cells are normalized. Explicit combo separators (`4K + Blu-ray`) are split before whole-cell matching, because "4K Blu-ray" is the single 4K format.
  - Rows are grouped into one movie by TMDB id, or by lowercase title + year + list.
  - Every movie is validated with the same `movieInputSchema` the form uses.
  - Bad rows are skipped individually and listed with their row numbers.
- **TMDB enrichment** only fills blank fields and never overwrites values from the file. Imported posters are cached locally the same way as posters saved from the form.
- **Stats** (`src/components/collection-stats.tsx`) calls `await connection()` before reading the DB. Without it, the stats would be baked into the prerendered shell at build time. The chart color is the single validated hue in the `--chart-bar` / `--chart-track` tokens in `globals.css`.

## Forms

`src/components/movie-form.tsx` is fully controlled. It posts its whole state as JSON in a hidden `payload` field. The server parses that field with the Zod schema in `src/lib/validation.ts`, which converts form strings to typed values (`""` → `null`, price → cents, comma-separated genres → array). Field errors come back keyed by Zod path, e.g. `copies.0.format`. The add and edit pages reuse this form. Edit passes `updateMovie.bind(null, id)`.

- **Element ids must be unique per form instance.** Use `fid(name)`, which is built on `useId()`. Next keeps recently visited pages mounted but hidden for back/forward, so an Add and an Edit form can be in the DOM together. Plain ids like `"title"` would make labels target the hidden form. In e2e tests, locate fields by label and use `.filter({ visible: true })` when a hidden copy may exist.
- Components rendered inside the movie form must not contain their own `<form>`, because forms can't nest (see `BarcodeLookup`).
- A server component can't import a constant from a `"use client"` module; it gets a client reference, not the value. Put shared constants in `src/lib/` (e.g. `TAG_SUGGESTIONS_ID` in `constants.ts`).

## Rendering with Cache Components

Nothing uses `"use cache"` yet, because every DB read happens at request time. Each page renders a static shell and awaits `params`/`searchParams` inside a child component wrapped in `<Suspense>`. Keep that pattern for new DB-reading pages: an uncached read outside `<Suspense>` triggers the blocking-route error. Don't call `new Date()` or `Date.now()` at module scope or during render either.

## Stack and version caveats

- **Next.js 16 / React 19**, App Router only, code under `src/`, import alias `@/*` → `src/*`. As AGENTS.md says, check `node_modules/next/dist/docs/` before relying on remembered Next.js APIs.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`. Those settings change how data fetching and caching behave in Server Components (dynamic data must be inside `<Suspense>` or explicitly cached), so read the bundled docs on Cache Components before writing data-loading code.
- Route components use the generated global types `PageProps<"/route">` / `LayoutProps<"/route">` (see `src/app/layout.tsx`) instead of hand-written props types.
- **Tailwind CSS v4**: there is no `tailwind.config.*`. Theme tokens live in `src/app/globals.css` (`@theme inline` maps CSS variables such as `--primary` and `--radius` to Tailwind utilities; `:root` and `.dark` hold light and dark values). CSS is processed through the `@tailwindcss/turbopack` loader configured in `next.config.ts`.

## shadcn/ui specifics

- Style is `base-nova` (see `components.json`). Components are built on **Base UI (`@base-ui/react`), not Radix**, so primitive props and composition patterns follow Base UI conventions (for example, the `render` prop rather than Radix's `asChild`). Check the generated component source before assuming a Radix API.
- Class merging uses the `cn` npm package (shadcn's drop-in replacement for clsx + tailwind-merge). Generated components import it as `from "cn"`; `@/lib/utils` just re-exports it.
- Files in `src/components/ui/` are generated but owned by this repo, so editing them is fine. Put app-specific components in `src/components/`.
- Icons come from `lucide-react`. Dark mode uses the `.dark` class variant on `<html>`, set by `next-themes` (`src/components/theme-provider.tsx`, defaulting to the OS setting). The header's `<ThemeToggle>` switches it. Theme-dependent visuals should use `dark:` classes or CSS tokens, not `useTheme()` during render, because the theme is unknown on the server.
- Base UI `Select` displays raw values unless the `items` prop (a value → label map) is passed to the root. Pass `null` as the value to show the placeholder.
- `<Toaster />` (sonner) is mounted in the root layout.
- ESLint includes React Compiler rules such as `react-hooks/set-state-in-effect`. Derive state during render, and set state only in async callbacks inside effects. `src/components/tmdb-search.tsx` shows the pattern.
