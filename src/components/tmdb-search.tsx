"use client";

import { FilmIcon, Loader2Icon, SearchIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import type { TmdbMovieDetails, TmdbSearchResult } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

type Props = {
  onSelect: (movie: TmdbMovieDetails) => void;
  initialQuery?: string;
  autoFocus?: boolean;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

type Completed = { query: string; results: TmdbSearchResult[]; error: string | null };

export function TmdbSearch({ onSelect, initialQuery = "", autoFocus }: Props) {
  const [query, setQuery] = useState(initialQuery);
  // Last finished search; what's displayed is derived from it vs. the current query.
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const q = query.trim();
  const active = q.length >= 2;
  const current = active && completed?.query === q ? completed : null;
  const searching = active && !current;
  const results = current?.results ?? [];
  const error = detailError ?? current?.error ?? null;

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<{ results: TmdbSearchResult[] }>(
          `/api/tmdb/search?q=${encodeURIComponent(q)}`,
          controller.signal,
        );
        setCompleted({ query: q, results: data.results, error: null });
      } catch (e) {
        if (controller.signal.aborted) return;
        setCompleted({ query: q, results: [], error: e instanceof Error ? e.message : "Search failed." });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  async function choose(r: TmdbSearchResult) {
    setLoadingId(r.tmdbId);
    setDetailError(null);
    try {
      onSelect(await getJson<TmdbMovieDetails>(`/api/tmdb/movie/${r.tmdbId}`));
      setQuery("");
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Couldn't load movie details.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDetailError(null);
          }}
          onKeyDown={(e) => {
            // Enter here must not submit the surrounding movie form.
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Search TMDB by title…"
          aria-label="Search TMDB"
          autoFocus={autoFocus}
          className="pl-8"
        />
        {searching && (
          <Loader2Icon
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          {error} You can still enter details manually below.
        </p>
      )}

      {current && !error && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No TMDB matches for &ldquo;{q}&rdquo;.</p>
      )}

      {results.length > 0 && (
        <ul aria-label="TMDB results" className="flex max-h-96 flex-col divide-y overflow-y-auto rounded-xl border border-primary/15 bg-card shadow-md shadow-primary/10">
          {results.map((r) => (
            <li key={r.tmdbId}>
              <button
                type="button"
                onClick={() => choose(r)}
                disabled={loadingId !== null}
                className={cn(
                  "flex w-full items-start gap-3 p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-60",
                  loadingId === r.tmdbId && "bg-accent",
                )}
              >
                <div className="relative flex aspect-[2/3] w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                  {r.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <FilmIcon className="size-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.title}
                    {r.releaseYear && <span className="font-normal text-muted-foreground"> ({r.releaseYear})</span>}
                  </p>
                  {r.overview && <p className="line-clamp-2 text-xs text-muted-foreground">{r.overview}</p>}
                </div>
                {loadingId === r.tmdbId && <Loader2Icon className="mt-1 size-4 shrink-0 animate-spin" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
