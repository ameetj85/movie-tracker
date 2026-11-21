import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteMovieButton } from "@/components/delete-movie-button";
import { FormatBadge, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteMovie } from "@/lib/actions";
import { formatDate, formatPrice, formatRuntime, formatTimestamp } from "@/lib/format";
import { parseIdParam } from "@/lib/params";
import { getMovie } from "@/lib/queries";

export default function MoviePage({ params }: PageProps<"/movies/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden />
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
  const movie = await getMovie(id);
  if (!movie) notFound();

  const facts = [movie.releaseYear, formatRuntime(movie.runtime), movie.director && `Directed by ${movie.director}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="grid gap-8 md:grid-cols-[minmax(0,260px)_1fr]">
      <Poster src={movie.posterUrl} title={movie.title} className="mx-auto w-full max-w-[260px] shadow-md" />

      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {movie.isWishlist ? <Badge variant="outline">Wishlist</Badge> : <WatchStatusBadge status={movie.watchStatus} />}
            <Rating value={movie.rating} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{movie.title}</h1>
          {facts && <p className="text-muted-foreground">{facts}</p>}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {movie.genres.map((g) => (
                <Badge key={g} variant="secondary">
                  {g}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Link href={`/movies/${movie.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <PencilIcon />
              Edit
            </Link>
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
            <ul className="divide-y rounded-lg border">
              {movie.copies.map((c) => {
                const details = [
                  c.condition,
                  formatDate(c.purchaseDate) && `Bought ${formatDate(c.purchaseDate)}`,
                  formatPrice(c.priceCents),
                ].filter(Boolean);
                return (
                  <li key={c.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <FormatBadge format={c.format} />
                      {c.edition && <span className="text-sm">{c.edition}</span>}
                    </div>
                    {details.length > 0 && <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
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
