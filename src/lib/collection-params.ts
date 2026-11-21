import { FORMATS, WATCH_STATUSES, type WatchStatus } from "./constants";

/** The collection page's state lives entirely in URL search params. */

export const SORTS = {
  title: "Title (A–Z)",
  year: "Release year (newest)",
  added: "Date added (newest)",
  rating: "Rating (highest)",
} as const;
export type SortKey = keyof typeof SORTS;

/** Format filter values: an exact format, or "digital" for any digital copy. */
export const DIGITAL_FILTER = "digital";

export type CollectionQuery = {
  view: "owned" | "wishlist";
  q: string;
  format: string | null;
  genre: string | null;
  status: WatchStatus | null;
  decade: number | null;
  sort: SortKey;
  layout: "grid" | "list";
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseCollectionQuery(sp: RawParams): CollectionQuery {
  const format = one(sp.format);
  const status = one(sp.status);
  const decade = Number(one(sp.decade));
  const sort = one(sp.sort);
  return {
    view: one(sp.view) === "wishlist" ? "wishlist" : "owned",
    q: one(sp.q)?.trim().slice(0, 200) ?? "",
    format:
      format && (format === DIGITAL_FILTER || (FORMATS as readonly string[]).includes(format)) ? format : null,
    genre: one(sp.genre)?.slice(0, 100) || null,
    status: status && (WATCH_STATUSES as readonly string[]).includes(status) ? (status as WatchStatus) : null,
    decade: Number.isInteger(decade) && decade % 10 === 0 && decade >= 1870 && decade <= 2100 ? decade : null,
    sort: sort && sort in SORTS ? (sort as SortKey) : "title",
    layout: one(sp.layout) === "list" ? "list" : "grid",
  };
}

/** True when any narrowing filter (not search/sort/layout) is active. */
export const hasFilters = (q: CollectionQuery) => Boolean(q.format || q.genre || q.status || q.decade);
