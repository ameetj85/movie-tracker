import { FilmIcon, FilterXIcon, PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { CollectionStats, CollectionStatsSkeleton } from "@/components/collection-stats";
import { FilterBar } from "@/components/filter-bar";
import { MovieCard } from "@/components/movie-card";
import { MovieTable } from "@/components/movie-table";
import { SearchInput } from "@/components/search-input";
import { TopRatedCarousel } from "@/components/top-rated-carousel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { hasFilters, parseCollectionQuery, type CollectionQuery } from "@/lib/collection-params";
import { getCollectionCounts, getFilterOptions, getTopRated, listMovies } from "@/lib/queries";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-gradient w-fit text-3xl font-bold tracking-tight">My Collection</h1>
      <Suspense fallback={<CollectionStatsSkeleton />}>
        <CollectionStats />
      </Suspense>
      <Suspense fallback={<TopRatedSkeleton />}>
        <TopRated />
      </Suspense>
      <Suspense fallback={<CollectionSkeleton />}>
        <Collection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TopRated() {
  // DB reads must happen per request, not get baked into the prerendered shell.
  await connection();
  const movies = await getTopRated(10);
  if (movies.length === 0) return null;
  return <TopRatedCarousel movies={movies} />;
}

function TopRatedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-40" />
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-36 shrink-0 rounded-2xl sm:w-40 lg:w-44" />
        ))}
      </div>
    </div>
  );
}

async function Collection({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const raw = await searchParams;
  const query = parseCollectionQuery(raw);

  const [movies, counts, options] = await Promise.all([
    listMovies(query),
    getCollectionCounts(),
    getFilterOptions(query.view),
  ]);

  // Switching tabs keeps search/sort/layout but drops filters that may not apply.
  const tabHref = (v: CollectionQuery["view"]) => {
    const params = new URLSearchParams();
    if (v === "wishlist") params.set("view", "wishlist");
    if (query.q) params.set("q", query.q);
    if (query.sort !== "title") params.set("sort", query.sort);
    if (query.layout !== "grid") params.set("layout", query.layout);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const filtered = Boolean(query.q) || hasFilters(query);
  const total = counts[query.view];

  return (
    <>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Collection view"
          className="inline-flex w-fit rounded-xl border border-primary/10 bg-accent/60 p-1 shadow-inner shadow-primary/5"
        >
          {(["owned", "wishlist"] as const).map((v) => (
            <Link
              key={v}
              href={tabHref(v)}
              aria-current={query.view === v ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                query.view === v
                  ? "bg-card text-primary shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-card/60 hover:text-accent-foreground",
              )}
            >
              {v === "owned" ? "Owned" : "Wishlist"}
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  query.view === v ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                {counts[v]}
              </span>
            </Link>
          ))}
        </nav>
        <SearchInput />
      </div>

      {total > 0 && <FilterBar query={query} options={options} />}

      {movies.length > 0 ? (
        <>
          {filtered && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {movies.length} of {total}
              {query.q && <> matching &ldquo;{query.q}&rdquo;</>}
            </p>
          )}
          {query.layout === "list" ? (
            <MovieTable movies={movies} />
          ) : (
            <ul className={GRID}>
              {movies.map((m) => (
                <li key={m.id}>
                  <MovieCard movie={m} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : filtered ? (
        <EmptyState
          icon={query.q ? <SearchXIcon /> : <FilterXIcon />}
          title="No matches"
          description={
            query.q
              ? `Nothing in your ${query.view} matches “${query.q}” with the current filters.`
              : `Nothing in your ${query.view} matches the current filters.`
          }
        />
      ) : (
        <EmptyState
          icon={<FilmIcon />}
          title={query.view === "wishlist" ? "Your wishlist is empty" : "Your vault is empty"}
          description={
            query.view === "wishlist"
              ? "Add movies you want to buy so you don't forget them at the store."
              : "Start cataloging the movies you own."
          }
          action={
            <Link href="/movies/add" className={buttonVariants()}>
              <PlusIcon />
              Add movie
            </Link>
          }
        />
      )}
    </>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-card/60 px-6 py-16 text-center shadow-sm shadow-primary/5">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500/15 to-fuchsia-500/15 text-primary shadow-inner [&_svg]:size-8">
        {icon}
      </div>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-full sm:max-w-sm" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-28" />
        ))}
      </div>
      <div className={GRID}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[2/3] rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </>
  );
}
