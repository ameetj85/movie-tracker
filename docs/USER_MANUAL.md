# Movie Vault — User Manual

Movie Vault keeps track of the movies you own: on disc, on tape, in digital stores, or as files. It also keeps a wishlist of movies you'd like to buy.

Everything is stored on your own computer. Your collection lives in a single file that you own and can back up. It never goes to a cloud service. The only outside services it contacts are optional: The Movie Database (TMDB) for posters and details, and a barcode database when you add a disc by its barcode.

---

## Contents

1. [Getting started](#1-getting-started)
2. [A quick tour](#2-a-quick-tour)
3. [Adding movies](#3-adding-movies)
4. [Your collection page](#4-your-collection-page)
5. [A movie's page](#5-a-movies-page)
6. [Owned movies and the wishlist](#6-owned-movies-and-the-wishlist)
7. [Shelves and lending](#7-shelves-and-lending)
8. [Watching: status, ratings and watch history](#8-watching-status-ratings-and-watch-history)
9. [Tags](#9-tags)
10. [Editing many movies at once](#10-editing-many-movies-at-once)
11. [Franchises](#11-franchises)
12. [Finding something to watch](#12-finding-something-to-watch)
13. [Import, export and TMDB refresh](#13-import-export-and-tmdb-refresh)
14. [Backups and restoring](#14-backups-and-restoring)
15. [Light and dark mode](#15-light-and-dark-mode)
16. [Troubleshooting](#16-troubleshooting)
17. [Reference](#17-reference)

---

## 1. Getting started

### What you need

- **Node.js** version 20 or newer, from [nodejs.org](https://nodejs.org).
- The Movie Vault project folder.
- *Optional, but recommended:* a free TMDB account for posters and movie details. Without it you can still add movies by hand.

### First-time setup

Open a terminal in the project folder and run:

```bash
npm install
```

### Connect TMDB (optional)

1. Create a free account at [themoviedb.org](https://www.themoviedb.org), then open **Settings → API** and request an API key.
2. In the project folder, create a file called `.env.local` with one of these lines:

   ```
   TMDB_READ_ACCESS_TOKEN=your-long-read-access-token
   ```

   or

   ```
   TMDB_API_KEY=your-short-api-key
   ```

   Use the "API Read Access Token" if you have it; it's the more secure of the two.
3. Restart Movie Vault (see below). If you use the production mode, rebuild it too.

When TMDB is connected, the Add page shows a **Find on TMDB** panel. When it isn't, that panel is hidden and you fill in details yourself.

### Starting Movie Vault

There are two ways to run it:

| Mode | Command | When to use it |
|---|---|---|
| **Everyday use** | `npm run build` once, then `npm start` | Faster pages. Run `npm run build` again after updating Movie Vault or changing `.env.local`. |
| **Development** | `npm run dev` | Picks up code changes instantly. Fine for everyday use too, just slower. |

Then open **http://localhost:3000** in your browser. Leave the terminal window open while you use the app; closing it stops Movie Vault.

The first time it starts, Movie Vault creates its database file (`movies.db`) in the project folder. There's nothing else to set up.

---

## 2. A quick tour

The bar along the top of every page has:

- **Movie Vault** (the logo), which takes you back to your collection.
- **Franchises**: series you own films from (see [section 11](#11-franchises)).
- **Import / Export**: spreadsheets, backups and TMDB refresh (see [sections 13](#13-import-export-and-tmdb-refresh) and [14](#14-backups-and-restoring)).
- **Add movie**.
- The **sun/moon switch** for light and dark mode.

On a phone-sized screen some of these show just an icon.

The **collection page** (the home page) shows, from top to bottom:

1. **Stats tiles:** how many movies you own, how many you've watched, and your top five formats.
2. **Top 10 rated:** a gently scrolling strip of your highest-rated owned movies.
3. **Owned / Wishlist** tabs and a **search** box.
4. **Filters, sorting, Surprise me** and the grid/list switch.
5. **Your movies**, 60 at a time.

---

## 3. Adding movies

Click **Add movie** in the top bar. The page has up to five sections; only **Title** and one **Format** are required for an owned movie.

### Option A — Find on TMDB (quickest)

1. Start typing the title in **Find on TMDB**. Results appear as you type.
2. Click the right film. The title, year, director, cast, genres, synopsis, runtime and poster are filled in for you, along with the film's franchise if it has one.
3. Fill in the **Ownership** section (format and so on) and click **Add to collection**.

Picking a film from TMDB only fills in movie details. Anything you've entered about your own copy, your rating or your notes is left alone.

### Option B — Add by barcode

1. In **Add by barcode**, type the number printed under the barcode on the back of the case, then press **Enter** or click **Look up**. Spaces and dashes are fine.
2. Movie Vault looks the barcode up, tidies the product name (for example, "Mill Creek - Fight Club [BLU-RAY]" becomes "Fight Club"), runs the TMDB search for you, and pre-selects the format (Blu-ray, 4K, DVD…).
3. Click the right search result, check the details, and save.

Good to know:

- The barcode is saved on the copy either way, even if the barcode database doesn't know the disc. You can also type a barcode straight into the **Barcode** field of any copy.
- If a disc with the same barcode is already in your vault, you'll see a warning with a link to it.
- **Scan** (camera) appears only in browsers that can read barcodes from the camera, such as Chrome on Android or on a Mac. It doesn't appear in Edge or Chrome on Windows; type the number there instead.
- The barcode database used is free but allows about **100 lookups a day**. Only the barcode number is sent to it.

### Option C — By hand

Fill in the fields yourself. You can paste a poster image address into **Poster URL**. When you save, Movie Vault downloads the image so it still shows when you're offline.

### The form, section by section

**Details:** Title (required), Release year, Runtime (minutes), Director, Genres and Cast (both comma-separated), Poster URL, Synopsis.

**Ownership:**

- **Owned / Wishlist** switch.
- One box per **copy** (format) you own. Use **Add format** for more, and the bin icon to remove one. Each copy has:
  - **Format** (required): 4K UHD, Blu-ray, DVD, VHS, Digital - Apple TV, Digital - Vudu/Fandango, Digital - Amazon Prime, Digital - Other, or Local File.
  - **Edition**: free text, with suggestions such as Steelbook, Criterion Collection or Director's Cut.
  - **Barcode**.
  - **Purchase date**: click it for a calendar. Use the **Month** and **Year** dropdowns to jump quickly; changing them moves the date you picked. **Today** and **Clear** are at the bottom.
  - **Price paid** and **Condition** (New / Sealed, Like New, Good, Fair, Poor).
  - **Location**, such as "Shelf B3".
  - **Loaned to** and **Loaned on** (see [section 7](#7-shelves-and-lending)).

**Personal:** Watch status, Rating (1–10), **Tags** (comma-separated; suggestions come from tags you've already used), Notes.

### Duplicate warning

If you already have the same film in the same format, Movie Vault says so before saving and links to the existing entry. "Same film" means the same title (ignoring capitals) or the same TMDB link. If it's intentional, a second copy for example, click **Save anyway**.

---

## 4. Your collection page

### Owned and Wishlist

The two tabs switch between movies you own and movies you want. The number next to each tab is its count.

### Search

The search box matches **title, director, cast and tags**, and updates as you type.

### Filters

Every filter only lists values that actually exist in your collection.

| Filter | Options |
|---|---|
| **Format** | All formats · Any digital · **Upgrade candidates (DVD/VHS only)** · each format you own |
| **Genre** | Each genre in your collection |
| **Watch status** *(Owned tab only)* | Unwatched · In Progress · Watched |
| **Decade** | e.g. 1990s, 2000s |
| **Location** *(Owned tab only)* | **On loan** · each shelf/location you've used |
| **Tag** | Each tag you've used (capitals don't matter) |

An active filter is highlighted. **Clear filters** resets them all.

**Upgrade candidates** shows films you own *only* on DVD and/or VHS, with no Blu-ray, 4K, digital or file copy. It's handy for planning replacements.

### Sorting

Title (A–Z) · Release year (newest) · Date added (newest) · Rating (highest) · **Recently watched** (by the last viewing you logged; films you never logged come last).

### Grid or list

The two icons at the right switch between poster **grid** and compact **list**. The list shows director, formats, status, rating and date added. On narrow screens some columns are hidden.

### Show more

Movie Vault shows **60 movies at a time**. If more match, a **Show N more** button appears at the bottom. Changing a filter or the sort starts again from the first 60.

### Sharing a view

The page address (URL) records your tab, search, filters, sort, layout and how many movies are shown. Bookmark it to return to exactly that view.

### Stats tiles

- **Movies owned**, with the total number of copies.
- **Watched**: the percentage of owned movies marked watched, how many are in progress, and how many viewings you've logged this year.
- **Top formats**: your five most-owned formats with a bar for each, plus "+ N more formats" if you have others.

### Top 10 rated

Your highest-rated **owned** movies glide past slowly in a loop. Movies with the same rating are in alphabetical order, and unrated movies aren't included.

- It **pauses** while your mouse is over it or you've tabbed into it with the keyboard.
- **Pause/Play** stops or restarts it.
- **‹ ›** move one movie left or right.
- You can **drag** or swipe it.
- If your computer is set to *reduce motion*, it starts paused.
- If all your rated movies fit on screen, it stays still.

---

## 5. A movie's page

Click any movie to open it. You'll see:

- **Poster**, watch status (or "Wishlist"), rating and title.
- Year, runtime and director, then genre badges.
- **Franchise** chip, which opens that series' page ([section 11](#11-franchises)), and **tag** chips, which show every movie with that tag.
- **Buttons:**
  - **Mark as purchased** *(wishlist only)*.
  - **Edit**.
  - **Refresh from TMDB** *(when TMDB is connected)*.
  - **Delete** (asks you to confirm).
- **Synopsis** and **Cast**.
- **Copies owned** (or **Wanted formats** for wishlist movies). Each copy shows its format badge, edition, an **On loan** badge if lent out, location, who has it and since when, condition, purchase date and price.
- **Watch history**, where you can log viewings ([section 8](#8-watching-status-ratings-and-watch-history)).
- **Notes**, and when the movie was added and last updated.

### Refresh from TMDB

Replaces this movie's details with TMDB's current ones: title, year, director, cast, genres, synopsis, runtime, poster and franchise. Your copies, rating, notes, tags, watch status and history are never changed. If the movie isn't linked to TMDB yet, it's matched by title and year. If that fails, open **Edit** and use **Find on TMDB** to pick the right film.

### Deleting

**Delete** removes the movie, all its copies and its watch history. Movie Vault takes a backup before changes like this ([section 14](#14-backups-and-restoring)), but there's no "undo" button in the app.

---

## 6. Owned movies and the wishlist

- **Owned** movies need at least one copy (format).
- **Wishlist** movies can list the formats you'd like ("Wanted formats"), but don't have to.
- Switch a movie between the two with the **Owned / Wishlist** switch in **Edit**.

### Mark as purchased

The fastest way to record buying something from your wishlist:

1. Open the wishlist movie and click **Mark as purchased**.
2. The first wanted format and today's date are filled in, with condition set to New / Sealed. Adjust the format, edition, purchase date, price, condition and location as needed.
3. Click **Move to collection**.

The movie becomes owned, with the copy you entered. Any other "wanted formats" on the wishlist entry are removed. If you already own that film in that format, you'll get the duplicate warning with **Save anyway**.

---

## 7. Shelves and lending

Location and loans are recorded **per copy**, because your 4K and your Blu-ray can live in different places.

### Shelf location

Type anything into a copy's **Location**: "Shelf B3", "Basement, box 2", "Living room". To find everything in one place, use the **Location** filter on the Owned tab.

### Lending a disc

1. Open the movie, then **Edit**.
2. In the copy you lent, fill in **Loaned to**, then pick **Loaned on**. The date only becomes available once there's a name.
3. Save.

The copy shows **Loaned to Sam since Nov 1, 2026**, and the movie gets an **On loan** badge in the grid, the list and on its page. **Location → On loan** shows everything currently lent out.

**When it comes back:** edit the movie and clear **Loaned to**. The loan date is cleared automatically.

---

## 8. Watching: status, ratings and watch history

### Watch status

Each movie is **Unwatched**, **In Progress** or **Watched**. Set it in **Edit**, with bulk edit ([section 10](#10-editing-many-movies-at-once)), or by logging a viewing.

### Rating

A personal rating from **1 to 10** (set in **Edit**, under Personal). Ratings power the **Rating** sort and the **Top 10 rated** strip.

### Watch history

On a movie's page, under **Watch history**:

1. Click **Log a viewing**.
2. Pick the date (today by default) and, optionally, add a note such as "with the kids".
3. Click **Save**.

Logging a viewing also marks the movie **Watched**. Every viewing is listed newest first; the **×** next to one removes it. Your history drives the **Recently watched** sort and the "viewings logged this year" count on the Watched tile.

---

## 9. Tags

Tags are your own labels, such as *Christmas*, *Kids*, *Date night* or *Rewatch*. A movie can have any number of them.

- **Add or change tags:** in **Edit**, under **Personal → Tags**, separated by commas. Tags you've used before are suggested as you type.
- **Find tagged movies:** use the **Tag** filter, type the tag in **search**, or click a tag chip on a movie's page.
- Capitals don't matter: "christmas" and "Christmas" are treated as the same tag.
- To tag or untag lots of movies at once, use bulk edit (next section).

---

## 10. Editing many movies at once

1. On the collection page, click **Select** (above the movies).
2. Click movies to select them. A selected movie is outlined, with a tick in the corner. In list view, tick the checkboxes. **Select all** picks every movie currently shown.
3. Choose an action from the bar:
   - **Mark watched** / **Mark unwatched** *(Owned tab)*.
   - **Add tag**: type a new tag or click an existing one.
   - **Remove tag**: pick from the tags the selected movies have.
   - **Delete**: asks you to confirm.
4. Click **Done** to leave selection mode.

Tip: filter or search first, then **Select all** to act on exactly that set. For example, filter by *Location: Basement, box 2* to tag everything in a box.

---

## 11. Franchises

**Franchises** in the top bar lists every series you own at least one film from, for example *Mission: Impossible: 2 owned · 1 on wishlist*. Open one to see the whole series from TMDB, in release order:

- **Owned** films are in colour with a green badge, and **Wishlist** films have a pink badge. Click either to open the movie.
- Films you don't have are greyed out, with an **Add to wishlist** button. It adds the film with full TMDB details and poster.
- A bar shows **You own N of M films**.

Movies get their franchise automatically when added through **Find on TMDB** or **Add by barcode**. For movies already in your vault, use **Refresh all from TMDB** on the Import / Export page once ([section 13](#13-import-export-and-tmdb-refresh)). Franchises need TMDB. Without it, a franchise page lists only the films in your vault.

---

## 12. Finding something to watch

**Surprise me** (the dice button next to the sort menu, Owned tab) opens a random **unwatched** movie you own. It respects your current search and filters, so filter to *Genre: Horror* first for a random unwatched horror film. If you've set a watch-status filter, that's used instead of "unwatched". If nothing matches, it tells you.

---

## 13. Import, export and TMDB refresh

Open **Import / Export** in the top bar.

### Export

- **Export CSV**: a spreadsheet with **one row per copy**. Movie details repeat on each row, and a movie with no copies gets a single row. It opens directly in Excel, Numbers or Google Sheets. Cells that start with `=`, `+`, `-` or `@` get a leading apostrophe so spreadsheets don't treat them as formulas; Movie Vault removes it again on import.
- **Export JSON**: a complete backup that also includes **watch history**.

Neither export includes poster images; those are re-downloaded from TMDB on import if needed.

### Import from CSV

1. Click **Choose CSV file** and pick a file (up to **5 MB** and **5,000 rows**).
2. Review the **preview**. Nothing is saved yet. It shows:
   - How many movies, copies and wishlist items it found.
   - Which of your columns it recognised. Click "Recognized columns" for the full list.
   - Movies you already have.
   - Rows with problems, with their row numbers.
3. Choose the options:
   - **Format for owned rows without one**: applied when a row has no format.
   - **Skip movies already in my collection**: matched by TMDB link or title + year.
   - **Fill in missing details and posters from TMDB**: only fills blanks and never overwrites anything from your file.
4. Click **Import N movies**. Progress is shown as it looks things up, downloads posters and saves. Everything is saved together at the end, and a backup is taken first.

**What files work:** a Movie Vault export, your own spreadsheet, or exports from apps like **Letterboxd** and **CLZ**. Only a **title** column is required. Common column names are recognised automatically, such as *Name*, *Year*, *Media Type*, *Purchase Price*, *Shelf*, *Lent To* and *UPC*. Some formats need nothing extra:

- **Format names are tidied:** "4K Ultra HD", "BD", "iTunes" and "Prime Video" are all recognised.
- **Combo packs** written with a separator, like "4K + Blu-ray", become two copies. "4K Blu-ray" without a separator is one 4K copy.
- **Rows with the same title and year** are merged into one movie with several copies.
- A `list` column set to **wishlist** puts movies on your wishlist.
- **Letterboxd** exports are detected. Their 5-star ratings are doubled to the 10-point scale, and the movies are marked watched.

Rows with errors are skipped individually; the rest import normally.

### Refresh all from TMDB

*(Shown when TMDB is connected.)* This fills in missing posters, cast, genres, synopses and runtimes for your **whole** vault, and records each film's **franchise**. It only fills blanks and never overwrites anything you've entered. Movies without a TMDB link are matched by title and year; any that can't be matched are listed so you can fix them by hand. Progress is shown as it goes.

---

## 14. Backups and restoring

Movie Vault backs up your database **automatically**:

- At most **once a day**, just before you save a change, so the backup is your collection as it was before the change.
- **Always before an import**.
- The newest **14** backups are kept; older ones are deleted.

The **Backups** section on the Import / Export page lists recent backups (date, type and size). **Back up now** makes one immediately.

Backups live in the `data/backups` folder of the project.

### Restoring a backup

1. Stop Movie Vault: press **Ctrl+C** in its terminal window.
2. In the project folder, copy the backup file (e.g. `data/backups/movies-2026-11-21T19-18-05.db`) over **`movies.db`**.
3. Delete `movies.db-wal` and `movies.db-shm` if they exist.
4. Start Movie Vault again.

### Backing up elsewhere

For extra safety, copy the whole project folder now and then, or at least `movies.db` and the `data` folder, which holds backups and posters, to another drive or a cloud folder. A **JSON export** is also a complete, readable copy of your data.

---

## 15. Light and dark mode

Use the **sun/moon switch** at the top right. Movie Vault remembers your choice in this browser. Until you choose, it follows your computer's light/dark setting.

---

## 16. Troubleshooting

| Problem | What to do |
|---|---|
| **The "Find on TMDB" panel is missing** | Add your TMDB key to `.env.local` ([section 1](#connect-tmdb-optional)). Restart, and if you use `npm start`, run `npm run build` first. |
| **"TMDB rejected the API credentials"** | The key in `.env.local` is wrong or expired. Copy it again from TMDB's API settings. |
| **"Couldn't reach TMDB"** | Check your internet connection. Everything else still works offline, including posters you've already saved. |
| **"Daily barcode lookup limit reached"** | The free barcode database allows about 100 lookups a day. Use **Find on TMDB** by title for now; you can still type the barcode into the copy. |
| **A barcode "isn't in the product database"** | Not every disc is listed. Search by title instead; the barcode is still saved on the copy. |
| **No Scan button** | Your browser can't read barcodes from the camera (Windows browsers can't). Type the number instead. |
| **A poster is missing** | The download may have failed when you saved. Open the movie and use **Refresh from TMDB**, or run **Refresh all from TMDB**. |
| **The page won't load at localhost:3000** | Make sure Movie Vault is running in a terminal (`npm start` or `npm run dev`). Another program may be using port 3000; the terminal shows the address it chose. |
| **Something looks wrong after updating Movie Vault** | Stop it, run `npm install`, then `npm run build` (for `npm start`), and start it again. Database updates apply automatically when it starts. |
| **I deleted something by mistake** | Restore the most recent backup from before the deletion ([section 14](#14-backups-and-restoring)). Anything added after that backup is lost, so export first if you need it. |

---

## 17. Reference

### Formats

4K UHD · Blu-ray · DVD · VHS · Digital - Apple TV · Digital - Vudu/Fandango · Digital - Amazon Prime · Digital - Other · Local File

### Conditions

New / Sealed · Like New · Good · Fair · Poor

### CSV columns (Movie Vault export)

`title, release_year, director, cast, genres, runtime, synopsis, tmdb_id, poster_url, list, watch_status, rating, notes, tags, format, edition, purchase_date, price, condition, location, loaned_to, loaned_on, upc, date_added`

- `genres` and `tags` are separated by `; `.
- `list` is `owned` or `wishlist`.
- Dates are `YYYY-MM-DD`.
- `price` is a plain number, e.g. `19.99`.

### Where your data lives

| What | Where (in the project folder) |
|---|---|
| Your collection | `movies.db` |
| Downloaded posters | `data/posters/` |
| Automatic backups | `data/backups/` |
| TMDB key | `.env.local` |

### Privacy

Movie Vault has no accounts and sends no usage data. It only contacts:

- **TMDB:** search text and movie IDs, when you use TMDB features. Poster images are downloaded from TMDB's image server.
- **UPCitemdb:** only the barcode number, when you click **Look up**.
