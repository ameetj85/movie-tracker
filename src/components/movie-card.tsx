import Link from "next/link";

import { FormatBadges, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import type { MovieWithCopies } from "@/db/schema";

export function MovieCard({ movie }: { movie: MovieWithCopies }) {
  return (
    <Link
      href={`/movies/${movie.id}`}
      className="group flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Poster
        src={movie.posterUrl}
        title={movie.title}
        className="shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md"
      />
      <div className="flex flex-col gap-1.5 px-0.5">
        <div>
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">{movie.title}</h3>
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
