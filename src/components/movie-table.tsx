import Link from "next/link";

import { FormatBadges, OnLoanBadge, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import type { MovieWithCopies } from "@/db/schema";
import { formatTimestamp } from "@/lib/format";

/** Compact list view of the collection. Columns collapse on small screens. */
export function MovieTable({ movies }: { movies: MovieWithCopies[] }) {
  const wishlist = movies[0]?.isWishlist ?? false;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-md shadow-primary/10">
      <table className="w-full text-sm">
        <thead className="bg-linear-to-r from-violet-500/10 to-fuchsia-500/10 text-left text-xs text-accent-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Title</th>
            <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Director</th>
            <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Formats</th>
            {!wishlist && <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Status</th>}
            <th scope="col" className="px-3 py-2 text-right font-medium">Rating</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium lg:table-cell">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {movies.map((m) => (
            <tr key={m.id} className="group relative transition-colors hover:bg-accent/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <Poster src={m.posterUrl} title={m.title} compact
                    className="w-8 shrink-0 rounded shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/30"
                  />
                  <div className="min-w-0">
                    {/* Stretched link: the whole row is clickable. */}
                    <Link
                      href={`/movies/${m.id}`}
                      className="font-medium transition-colors outline-none group-hover:text-primary after:absolute after:inset-0 focus-visible:underline"
                    >
                      {m.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.releaseYear ?? "—"}</div>
                    <FormatBadges formats={m.copies.map((c) => c.format)} short className="mt-1 sm:hidden" />
                  </div>
                </div>
              </td>
              <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{m.director ?? "—"}</td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <FormatBadges formats={m.copies.map((c) => c.format)} short />
              </td>
              {!wishlist && (
                <td className="hidden px-3 py-2 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <WatchStatusBadge status={m.watchStatus} />
                    {m.copies.some((c) => c.loanedTo) && <OnLoanBadge to={m.copies.find((c) => c.loanedTo)?.loanedTo} />}
                  </div>
                </td>
              )}
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {m.rating == null ? <span className="text-muted-foreground">—</span> : <Rating value={m.rating} />}
              </td>
              <td className="hidden px-3 py-2 text-right whitespace-nowrap text-muted-foreground lg:table-cell">
                {formatTimestamp(m.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
