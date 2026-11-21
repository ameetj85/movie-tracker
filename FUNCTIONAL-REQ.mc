Here is a complete, typical REQUIREMENTS.md (or Product Requirements Document) tailored for a personal owned-movie tracker built with Next.js and SQLite.

Project Requirements Document: Personal Movie Vault


1. Project Overview

A local-first, full-stack web application designed to catalog, search, and manage a personal collection of owned movies (physical media like 4K UHD, Blu-ray, DVD, and digital copies).

2. Tech Stack

• Framework: Next.js (App Router) with TypeScript
• Database: SQLite (local file-based storage, e.g., movies.db)
• ORM / Query Builder: Drizzle ORM or Prisma (for type-safe database interactions and schema migrations)
• Styling: Tailwind CSS (optional: shadcn/ui for rapid UI components)
• External API (Optional): TMDB (The Movie Database) API to auto-fetch movie posters, release years, genres, and synopses.

3. Core Functional Requirements


3.1. Collection Management (CRUD)

• Add Movie: Users can add a new movie to their collection manually or by searching via an external API (TMDB) to auto-fill metadata.
• View Collection: Display owned movies in a responsive grid (poster view) or list/table view.
• Edit Movie: Update details of an owned movie (e.g., changing format, adding personal notes, updating watch status).
• Delete Movie: Remove a movie from the collection with a confirmation prompt.

3.2. Ownership & Media Tracking

• Format Tracking: Specify how the movie is owned (e.g., 4K UHD, Blu-ray, DVD, VHS, Digital - Apple TV, Digital - Vudu/Fandango, Local File). Support owning multiple formats of the same movie.
• Edition / Packaging Notes: Track special editions (e.g., Steelbook, Criterion Collection, Director's Cut, Slipcover).
• Purchase Details (Optional): Track purchase date, price paid, and condition.

3.3. Watch Status & Personalization

• Watch Status: Mark movies as Watched, Unwatched, or In Progress.
• Personal Rating: Assign a personal rating (e.g., 1–5 stars or 1–10 scale).
• Personal Review/Notes: Add custom text notes or thoughts about the movie or disc quality.
• Watchlist / Wishlist Flag: Distinguish between movies currently Owned vs. movies on a Wishlist to buy later.

3.4. Search, Filter, & Sort

• Search: Real-time search by movie title, director, or cast.
• Filter: Filter the collection by:
	• Format (4K, Blu-ray, Digital, etc.)
	• Genre (Action, Sci-Fi, Horror, etc.)
	• Watch Status (Watched vs. Unwatched)
	• Decade / Release Year
• Sort: Sort results by Title (A–Z), Release Year, Date Added, or Personal Rating.

3.5. Data Portability

• Export: Export the entire SQLite collection to a .csv or .json file for backup.
• Import: Bulk import movies from a .csv file (useful for migrating from spreadsheets or apps like Letterboxd/CLZ).

4. Database Schema (SQLite)


Table: movies


Column	Type	Constraints	Description
id	INTEGER	PRIMARY KEY AUTOINCREMENT	Unique internal ID
tmdb_id	INTEGER	NULLABLE	External ID for syncing metadata
title	TEXT	NOT NULL	Movie title
release_year	INTEGER	NULLABLE	Year released
director	TEXT	NULLABLE	Primary director
genres	TEXT	NULLABLE	JSON array or comma-separated string
poster_url	TEXT	NULLABLE	Local path or external URL to cover art
synopsis	TEXT	NULLABLE	Short plot summary
runtime	INTEGER	NULLABLE	Length in minutes
format	TEXT	NOT NULL	e.g., "4K UHD", "Blu-ray", "DVD", "Digital"
edition	TEXT	NULLABLE	e.g., "Steelbook", "Standard"
is_wishlist	BOOLEAN	DEFAULT 0	0 = Owned, 1 = Wishlist
watched	BOOLEAN	DEFAULT 0	0 = Unwatched, 1 = Watched
rating	INTEGER	NULLABLE	User rating (1–10)
notes	TEXT	NULLABLE	Personal notes or location on shelf
created_at	DATETIME	DEFAULT CURRENT_TIMESTAMP	When added to database
updated_at	DATETIME	DEFAULT CURRENT_TIMESTAMP	Last modified timestamp


5. Non-Functional Requirements

• Performance: Queries against the local SQLite database should execute in under 50ms. Images should be optimized using next/image or cached locally.
• Offline Capability: Once metadata/posters are saved, browsing, searching, and editing the collection must work entirely offline.
• Responsive Design: UI must be usable on desktop (for managing data) and mobile devices (useful when browsing physical shelves at a store to avoid buying duplicates).
• Data Integrity: Prevent accidental duplicate entries (warn the user if they try to add a title/format combination that already exists).

6. Recommended Folder Structure (Next.js App Router)

text
├── prisma/ (or drizzle/)     # Database schema & migrations
│   └── schema.prisma
├── public/
│   └── posters/              # Locally cached movie posters (optional)
├── src/
│   ├── app/
│   │   ├── api/              # Route handlers (TMDB search, CSV export)
│   │   ├── movies/
│   │   │   ├── [id]/         # Movie detail & edit page
│   │   │   └── add/          # Add new movie page
│   │   ├── layout.tsx
│   │   └── page.tsx          # Main dashboard (grid/filter view)
│   ├── components/           # Reusable UI (MovieCard, FilterBar, SearchModal)
│   ├── lib/
│   │   ├── db.ts             # SQLite connection instance
│   │   └── actions.ts        # Next.js Server Actions for CRUD operations
│   └── types/                # TypeScript interfaces
├── movies.db                 # The actual SQLite database file (gitignored)
└── .env.local                # Environment variables (e.g., TMDB_API_KEY)
Use code with caution.

7. Phased Development Milestones

• Phase 1 (MVP): Set up Next.js, SQLite, and ORM. Build basic manual CRUD (Add, View, Edit, Delete) and basic title search.
• Phase 2 (Metadata & UI): Integrate TMDB API to auto-populate posters and movie info. Add format badges (4K, Blu-ray) and filtering.
• Phase 3 (Stats & Polish): Add a dashboard header showing stats (Total Movies Owned, Breakdown by Format, % Watched) and implement CSV export/import.
