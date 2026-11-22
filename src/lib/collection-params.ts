import { FORMATS, WATCH_STATUSES, type WatchStatus } from "./constants";

/** The collection page's state lives entirely in URL search params. */

export const SORTS = {
  title: "Title (A–Z)",
  year: "Release year (newest)",
  added: "Date added (newest)",
  rating: "Rating (highest)",
  watched: "Recently watched",
} as const;
export type SortKey = keyof typeof SORTS;

/** Format filter values: an exact format, "digital" for any digital copy, or upgrade candidates. */
export const DIGITAL_FILTER = "digital";
/** Owned only on DVD and/or VHS: candidates for a Blu-ray/4K upgrade. */
export const UPGRADE_FILTER = "@upgrade";
/** The formats an upgrade candidate is limited to. */
export const LOW_DEF_FORMATS = ["DVD", "VHS"] as const;

/** Location filter values: an exact shelf location, or this for "any copy on loan". */
export const LOANED_FILTER = "@loaned";

/** Movies rendered per "page"; "Show more" adds another page via the `show` param. */
export const PAGE_SIZE = 60;
const MAX_SHOWN = 10_000;

export type CollectionQuery = {
  view: "owned" | "wishlist";
  q: string;
  format: string | null;
  genre: string | null;
  status: WatchStatus | null;
  decade: number | null;
  location: string | null;
  tag: string | null;
  sort: SortKey;
  layout: "grid" | "list";
  /** How many movies to render (a multiple of PAGE_SIZE). */
  show: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseCollectionQuery(sp: RawParams): CollectionQuery {
  const format = one(sp.format);
  const status = one(sp.status);
  const decade = Number(one(sp.decade));
  const sort = one(sp.sort);
  const show = Number(one(sp.show));
  return {
    view: one(sp.view) === "wishlist" ? "wishlist" : "owned",
    q: one(sp.q)?.trim().slice(0, 200) ?? "",
    format:
      format &&
      (format === DIGITAL_FILTER || format === UPGRADE_FILTER || (FORMATS as readonly string[]).includes(format))
        ? format
        : null,
    genre: one(sp.genre)?.slice(0, 100) || null,
    status: status && (WATCH_STATUSES as readonly string[]).includes(status) ? (status as WatchStatus) : null,
    decade: Number.isInteger(decade) && decade % 10 === 0 && decade >= 1870 && decade <= 2100 ? decade : null,
    location: one(sp.location)?.trim().slice(0, 100) || null,
    tag: one(sp.tag)?.trim().slice(0, 40) || null,
    sort: sort && sort in SORTS ? (sort as SortKey) : "title",
    layout: one(sp.layout) === "list" ? "list" : "grid",
    show:
      Number.isInteger(show) && show > PAGE_SIZE
        ? Math.min(Math.ceil(show / PAGE_SIZE) * PAGE_SIZE, MAX_SHOWN)
        : PAGE_SIZE,
  };
}

/** True when any narrowing filter (not search/sort/layout) is active. */
export const hasFilters = (q: CollectionQuery) =>
  Boolean(q.format || q.genre || q.status || q.decade || q.location || q.tag);
