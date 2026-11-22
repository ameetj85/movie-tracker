import Link from "next/link";

import { FormatBadges, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import type { MovieWithCopies } from "@/db/schema";

export function MovieCard({ movie }: { movie: MovieWithCopies }) {
  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex h-full flex-col gap-2.5 rounded-2xl bg-card p-2 shadow-sm ring-1 shadow-primary/10 ring-primary/10 transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/25 hover:ring-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Poster
        src={movie.posterUrl}
        title={movie.title}
        className="rounded-xl after:pointer-events-none after:absolute after:inset-0 after:bg-linear-to-t after:from-violet-950/45 after:via-transparent after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100 [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
      />
      <div className="flex flex-col gap-1.5 px-1 pb-1">
        <div>
          <h3 className="line-clamp-2 text-sm leading-snug font-medium transition-colors group-hover:text-primary">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{movie.releaseYear ?? "—"}</span>
            <Rating value={movie.rating} className="text-xs" />
          </div>
        </div>
        <FormatBadges formats={movie.copies.map((c) => c.format)} short />
        {!movie.isWishlist && movie.watchStatus !== "unwatched" && (
          <div>
            <WatchStatusBadge status={movie.watchStatus} />
          </div>
        )}
      </div>
    </Link>
  );
}
