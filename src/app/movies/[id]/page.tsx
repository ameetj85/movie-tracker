import { ArrowLeftIcon, HandshakeIcon, LayersIcon, MapPinIcon, PencilIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteMovieButton } from "@/components/delete-movie-button";
import { MarkPurchasedDialog } from "@/components/mark-purchased-dialog";
import { FormatBadge, OnLoanBadge, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import { RefreshTmdbButton } from "@/components/refresh-tmdb-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchHistory } from "@/components/watch-history";
import { deleteMovie, markPurchased } from "@/lib/actions";
import { formatDate, formatPrice, formatRuntime, formatTimestamp } from "@/lib/format";
import { parseIdParam } from "@/lib/params";
import { getMovie, getViewings } from "@/lib/queries";
import { isTmdbConfigured } from "@/lib/tmdb";

export default function MoviePage({ params }: PageProps<"/movies/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="group inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Back to collection
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <MovieDetail params={params} />
      </Suspense>
    </div>
  );
}

async function MovieDetail({ params }: Pick<PageProps<"/movies/[id]">, "params">) {
  const id = parseIdParam((await params).id);
  const [movie, history] = await Promise.all([getMovie(id), getViewings(id)]);
  if (!movie) notFound();

  const facts = [movie.releaseYear, formatRuntime(movie.runtime), movie.director && `Directed by ${movie.director}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="grid gap-8 md:grid-cols-[minmax(0,260px)_1fr]">
      <Poster src={movie.posterUrl} title={movie.title} className="mx-auto w-full max-w-[260px] rounded-2xl shadow-2xl ring-1 shadow-primary/30 ring-primary/15 transition-transform duration-500 hover:-translate-y-1 hover:rotate-[0.5deg]"
      />

      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {movie.isWishlist ? <Badge variant="outline">Wishlist</Badge> : <WatchStatusBadge status={movie.watchStatus} />}
            <Rating value={movie.rating} />
          </div>
          <h1 className="text-gradient w-fit pb-1 text-4xl font-bold tracking-tight text-balance">{movie.title}</h1>
          {facts && <p className="text-muted-foreground">{facts}</p>}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {movie.genres.map((g) => (
                <Badge key={g} variant="secondary" className="transition-colors hover:bg-primary hover:text-primary-foreground">
                  {g}
                </Badge>
              ))}
            </div>
          )}
          {(movie.tags?.length || movie.tmdbCollectionId) && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {movie.tmdbCollectionId && (
                <Link
                  href={`/franchises/${movie.tmdbCollectionId}`}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <LayersIcon className="size-3.5" aria-hidden />
                  {movie.tmdbCollectionName ?? "Franchise"}
                </Link>
              )}
              {movie.tags?.map((t) => (
                <Link
                  key={t}
                  href={`/?tag=${encodeURIComponent(t)}${movie.isWishlist ? "&view=wishlist" : ""}`}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-400 dark:bg-amber-400/15 dark:text-amber-300 dark:hover:bg-amber-400/30"
                >
                  <TagIcon className="size-3" aria-hidden />
                  {t}
                </Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {movie.isWishlist && (
              <MarkPurchasedDialog
                title={movie.title}
                wantedFormats={movie.copies.map((c) => c.format)}
                action={markPurchased.bind(null, movie.id)}
              />
            )}
            <Link href={`/movies/${movie.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <PencilIcon />
              Edit
            </Link>
            {isTmdbConfigured() && <RefreshTmdbButton movieId={movie.id} />}
            <DeleteMovieButton title={movie.title} action={deleteMovie.bind(null, movie.id)} />
          </div>
        </header>

        {movie.synopsis && <p className="max-w-prose leading-relaxed">{movie.synopsis}</p>}

        {movie.cast && (
          <DetailBlock title="Cast">
            <p className="text-sm">{movie.cast}</p>
          </DetailBlock>
        )}

        <DetailBlock title={movie.isWishlist ? "Wanted formats" : "Copies owned"}>
          {movie.copies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No formats listed.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border border-primary/10 bg-card shadow-md shadow-primary/10">
              {movie.copies.map((c) => {
                const details = [
                  c.condition,
                  formatDate(c.purchaseDate) && `Bought ${formatDate(c.purchaseDate)}`,
                  formatPrice(c.priceCents),
                ].filter(Boolean);
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1 p-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FormatBadge format={c.format} />
                        {c.edition && <span className="text-sm">{c.edition}</span>}
                        {c.loanedTo && <OnLoanBadge />}
                      </div>
                      {(c.location || c.loanedTo) && (
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          {c.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPinIcon className="size-3.5 text-primary" aria-hidden />
                              {c.location}
                            </span>
                          )}
                          {c.loanedTo && (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <HandshakeIcon className="size-3.5" aria-hidden />
                              Loaned to {c.loanedTo}
                              {c.loanedOn && ` since ${formatDate(c.loanedOn)}`}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    {details.length > 0 && <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </DetailBlock>

        <DetailBlock title={`Watch history${history.length ? ` · ${history.length}` : ""}`}>
          <WatchHistory movieId={movie.id} viewings={history} />
        </DetailBlock>

        {movie.notes && (
          <DetailBlock title="Notes">
            <p className="max-w-prose text-sm whitespace-pre-wrap">{movie.notes}</p>
          </DetailBlock>
        )}

        <p className="text-xs text-muted-foreground">
          Added {formatTimestamp(movie.createdAt)}
          {movie.updatedAt !== movie.createdAt && ` · Updated ${formatTimestamp(movie.updatedAt)}`}
        </p>
      </div>
    </article>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,260px)_1fr]">
      <Skeleton className="mx-auto aspect-[2/3] w-full max-w-[260px] rounded-lg" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
