import { FORMATS, type WatchStatus } from "./constants";

/**
 * CSV layout shared by export and import. One row per copy; movie-level
 * columns repeat on each of a movie's rows. A movie with no copies (e.g. a
 * wishlist item) is a single row with empty copy columns.
 */
export const CSV_COLUMNS = [
  "title",
  "release_year",
  "director",
  "cast",
  "genres",
  "runtime",
  "synopsis",
  "tmdb_id",
  "poster_url",
  "list",
  "watch_status",
  "rating",
  "notes",
  "tags",
  "format",
  "edition",
  "purchase_date",
  "price",
  "condition",
  "location",
  "loaned_to",
  "loaned_on",
  "upc",
  "date_added",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/**
 * Header aliases (compared after lowercasing and stripping non-alphanumerics),
 * so spreadsheets and exports from Letterboxd / CLZ map without editing.
 */
const ALIASES: Record<CsvColumn, string[]> = {
  title: ["title", "name", "movie", "movietitle", "film"],
  release_year: ["releaseyear", "year", "released", "releasedate", "moviereleaseyear"],
  director: ["director", "directors", "directedby"],
  cast: ["cast", "actors", "starring", "stars"],
  genres: ["genres", "genre"],
  runtime: ["runtime", "runningtime", "length", "minutes", "duration"],
  synopsis: ["synopsis", "overview", "plot", "description", "summary"],
  tmdb_id: ["tmdbid", "tmdb", "themoviedbid"],
  poster_url: ["posterurl", "poster", "coverurl", "cover", "image"],
  list: ["list", "iswishlist", "wishlist", "collectionstatus", "ownership", "owned"],
  watch_status: ["watchstatus", "watched", "seen", "status", "viewed"],
  rating: ["rating", "myrating", "yourrating", "personalrating", "score", "userrating"],
  notes: ["notes", "note", "review", "comments", "comment", "mynotes"],
  tags: ["tags", "tag", "labels", "label", "mytags", "customlists"],
  format: ["format", "formats", "media", "mediatype", "medium", "type", "disc"],
  edition: ["edition", "editions", "version", "packaging"],
  purchase_date: ["purchasedate", "purchased", "dateacquired", "acquired", "boughton"],
  price: ["price", "purchaseprice", "pricepaid", "cost", "paid"],
  condition: ["condition"],
  location: ["location", "shelf", "shelflocation", "storage", "storagelocation", "storagedevice"],
  loaned_to: ["loanedto", "loanto", "lentto", "borrower", "borrowedby", "loanedout"],
  loaned_on: ["loanedon", "loandate", "lenton", "datelent", "loanedsince"],
  upc: ["upc", "ean", "barcode", "upcean", "upcbarcode", "gtin"],
  date_added: ["dateadded", "added", "createdat", "addeddate"],
};

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ColumnMap = Partial<Record<CsvColumn, string>>;

/** Map our logical columns to the file's actual header names. */
export function resolveColumns(headers: string[]): { map: ColumnMap; isLetterboxd: boolean } {
  const byKey = new Map(headers.map((h) => [normKey(h), h]));
  const map: ColumnMap = {};
  const used = new Set<string>();
  for (const [col, aliases] of Object.entries(ALIASES) as [keyof ColumnMap, string[]][]) {
    for (const a of aliases) {
      const h = byKey.get(a);
      if (h && !used.has(h)) {
        map[col] = h;
        used.add(h);
        break;
      }
    }
  }
  return { map, isLetterboxd: byKey.has("letterboxduri") };
}

const FORMAT_ALIASES: Record<string, (typeof FORMATS)[number]> = {
  "4k": "4K UHD",
  "4kuhd": "4K UHD",
  uhd: "4K UHD",
  "4kultrahd": "4K UHD",
  ultrahd: "4K UHD",
  ultrahdbluray: "4K UHD",
  "4kbluray": "4K UHD",
  "4kuhdbluray": "4K UHD",
  bluray: "Blu-ray",
  bd: "Blu-ray",
  blueray: "Blu-ray",
  bluray3d: "Blu-ray",
  "3dbluray": "Blu-ray",
  dvd: "DVD",
  vhs: "VHS",
  apple: "Digital - Apple TV",
  appletv: "Digital - Apple TV",
  itunes: "Digital - Apple TV",
  digitalappletv: "Digital - Apple TV",
  digitalitunes: "Digital - Apple TV",
  vudu: "Digital - Vudu/Fandango",
  fandango: "Digital - Vudu/Fandango",
  fandangoathome: "Digital - Vudu/Fandango",
  vudufandango: "Digital - Vudu/Fandango",
  digitalvudu: "Digital - Vudu/Fandango",
  digitalvudufandango: "Digital - Vudu/Fandango",
  digital: "Digital - Other",
  digitalcopy: "Digital - Other",
  digitalhd: "Digital - Other",
  digitalother: "Digital - Other",
  moviesanywhere: "Digital - Other",
  googleplay: "Digital - Other",
  amazon: "Digital - Amazon Prime",
  amazonprime: "Digital - Amazon Prime",
  amazonvideo: "Digital - Amazon Prime",
  amazonprimevideo: "Digital - Amazon Prime",
  primevideo: "Digital - Amazon Prime",
  digitalamazon: "Digital - Amazon Prime",
  file: "Local File",
  localfile: "Local File",
  mkv: "Local File",
  mp4: "Local File",
  plex: "Local File",
};
for (const f of FORMATS) FORMAT_ALIASES[normKey(f)] = f;

/**
 * Normalize a format cell to known formats. Combo packs ("4K + Blu-ray") yield
 * several. Returns `unknown` for parts that don't match any known format.
 */
export function parseFormats(raw: string): { formats: string[]; unknown: string[] } {
  const cell = raw.trim();
  if (!cell) return { formats: [], unknown: [] };
  // Split on explicit combo separators first: "4K + Blu-ray" is two copies,
  // whereas "4K Blu-ray" (no separator) is the single 4K UHD format.
  const parts = cell.split(/\s*(?:[;|+,&]|\s\/\s|\band\b)\s*/i).filter(Boolean);
  const formats: string[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    const f = FORMAT_ALIASES[normKey(part)];
    if (f) {
      if (!formats.includes(f)) formats.push(f);
    } else unknown.push(part);
  }
  // e.g. "Vudu / Fandango" splits into parts that don't stand alone; retry whole.
  if (unknown.length) {
    const whole = FORMAT_ALIASES[normKey(cell)];
    if (whole) return { formats: [whole], unknown: [] };
  }
  return { formats, unknown };
}

export function parseWatchStatus(raw: string): WatchStatus | null {
  const v = normKey(raw);
  if (["", "no", "false", "0", "unwatched", "notwatched", "unseen", "n"].includes(v)) return "unwatched";
  if (["inprogress", "watching", "started", "partial", "progress"].includes(v)) return "in_progress";
  if (["watched", "yes", "true", "1", "seen", "y", "x", "done", "complete", "completed"].includes(v)) return "watched";
  // Letterboxd-style dates in a "watched" column mean it was watched.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return "watched";
  return null;
}

/** Interprets list/ownership columns; `column` is the header that matched. */
export function parseIsWishlist(raw: string, header: string): boolean | null {
  const v = normKey(raw);
  const key = normKey(header);
  if (v === "") return false;
  const truthy = ["yes", "true", "1", "y", "x"].includes(v);
  const falsy = ["no", "false", "0", "n"].includes(v);
  if (key === "owned") return truthy ? false : falsy ? true : null;
  if (key === "iswishlist" || key === "wishlist") {
    if (truthy || v === "wishlist") return true;
    if (falsy || v === "owned") return false;
  }
  if (["wishlist", "want", "wanted", "towatch", "tobuy", "ordered", "preordered", "onorder"].includes(v)) return true;
  if (["owned", "own", "incollection", "collection", "have"].includes(v)) return false;
  return null;
}

/** Accepts YYYY-MM-DD, M/D/YYYY, or anything Date can parse; returns YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return iso(+m[3], +m[1], +m[2]);
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** date_added → SQLite CURRENT_TIMESTAMP format ("YYYY-MM-DD HH:MM:SS", UTC). */
export function parseTimestamp(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return v;
  const date = parseDate(v);
  return date ? `${date} 00:00:00` : null;
}

/** "$1,299.99" / "1299,99"-ish → "1299.99" (still a string; validation parses it). */
export function cleanPrice(raw: string): string {
  return raw.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
}

/** Year from "1999" or a full date "1999-03-31". */
export function cleanYear(raw: string): string {
  const m = /\b(\d{4})\b/.exec(raw);
  return m ? m[1] : raw.trim();
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralize spreadsheet formula injection in exported cells. */
export function escapeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Reverse of escapeCell for re-imported exports. */
export function unescapeCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

/** Genres may be separated by ; or , in a single cell. */
export function splitList(raw: string): string[] {
  return raw
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
