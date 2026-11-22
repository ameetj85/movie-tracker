import "server-only";

const API = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY);
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) {
    throw new TmdbError("TMDB is not configured. Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in .env.local.", 503);
  }

  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Prefer the v4 bearer token (keeps the secret out of URLs/logs); fall back to the v3 key.
  if (!token && apiKey) url.searchParams.set("api_key", apiKey);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new TmdbError("Couldn't reach TMDB. Check your internet connection.", 502);
  }
  if (res.status === 401) throw new TmdbError("TMDB rejected the API credentials.", 502);
  if (res.status === 404) throw new TmdbError("Movie not found on TMDB.", 404);
  if (!res.ok) throw new TmdbError(`TMDB request failed (${res.status}).`, 502);
  return res.json() as Promise<T>;
}

export function tmdbPosterUrl(posterPath: string | null, size: "w92" | "w185" | "w500" = "w500"): string | null {
  return posterPath ? `${TMDB_IMAGE_BASE}/${size}${posterPath}` : null;
}

const yearOf = (date: string | undefined) => (date ? Number(date.slice(0, 4)) || null : null);

export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  overview: string;
  thumbUrl: string | null;
};

type RawSearch = {
  results: {
    id: number;
    title: string;
    release_date?: string;
    overview?: string;
    poster_path: string | null;
  }[];
};

export async function searchTmdb(query: string, year?: number): Promise<TmdbSearchResult[]> {
  const params: Record<string, string> = { query, include_adult: "false", language: "en-US", page: "1" };
  if (year) params.year = String(year);
  const data = await tmdbFetch<RawSearch>("/search/movie", params);
  return data.results.slice(0, 12).map((r) => ({
    tmdbId: r.id,
    title: r.title,
    releaseYear: yearOf(r.release_date),
    overview: r.overview ?? "",
    thumbUrl: tmdbPosterUrl(r.poster_path, "w92"),
  }));
}

export type TmdbMovieDetails = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  director: string | null;
  cast: string | null;
  genres: string[];
  synopsis: string | null;
  runtime: number | null;
  /** Remote TMDB poster URL; downloaded to the local cache when the movie is saved. */
  posterUrl: string | null;
  /** The franchise ("collection" in TMDB terms) the film belongs to, if any. */
  collection: { id: number; name: string } | null;
};

type RawDetails = {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  runtime?: number | null;
  poster_path: string | null;
  genres: { name: string }[];
  belongs_to_collection?: { id: number; name: string } | null;
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
};

const CAST_LIMIT = 8;

export async function getTmdbMovie(tmdbId: number): Promise<TmdbMovieDetails> {
  const d = await tmdbFetch<RawDetails>(`/movie/${tmdbId}`, { append_to_response: "credits", language: "en-US" });
  const directors = [...new Set(d.credits?.crew.filter((c) => c.job === "Director").map((c) => c.name) ?? [])];
  const cast = (d.credits?.cast ?? [])
    .toSorted((a, b) => a.order - b.order)
    .slice(0, CAST_LIMIT)
    .map((c) => c.name);
  return {
    tmdbId: d.id,
    title: d.title,
    releaseYear: yearOf(d.release_date),
    director: directors.join(", ") || null,
    cast: cast.join(", ") || null,
    genres: d.genres.map((g) => g.name),
    synopsis: d.overview || null,
    runtime: d.runtime || null,
    posterUrl: tmdbPosterUrl(d.poster_path, "w500"),
    collection: d.belongs_to_collection
      ? { id: d.belongs_to_collection.id, name: d.belongs_to_collection.name }
      : null,
  };
}

export type TmdbCollection = {
  id: number;
  name: string;
  /** Films in release order; unreleased ones (no date) last. */
  parts: { tmdbId: number; title: string; releaseYear: number | null; thumbUrl: string | null }[];
};

type RawCollection = {
  id: number;
  name: string;
  parts: { id: number; title: string; release_date?: string; poster_path: string | null }[];
};

/** A franchise and all its films. */
export async function getTmdbCollection(collectionId: number): Promise<TmdbCollection> {
  const c = await tmdbFetch<RawCollection>(`/collection/${collectionId}`, { language: "en-US" });
  const parts = c.parts
    .map((p) => ({
      tmdbId: p.id,
      title: p.title,
      releaseYear: yearOf(p.release_date),
      thumbUrl: tmdbPosterUrl(p.poster_path, "w185"),
    }))
    .toSorted((a, b) => (a.releaseYear ?? 9999) - (b.releaseYear ?? 9999));
  return { id: c.id, name: c.name, parts };
}
