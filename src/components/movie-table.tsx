import Link from "next/link";

import { FormatBadges, OnLoanBadge, Rating, WatchStatusBadge } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import { Checkbox } from "@/components/ui/checkbox";
import type { MovieWithCopies } from "@/db/schema";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Selection mode (bulk edit): rows toggle instead of opening the movie. */
export type TableSelection = { selected: ReadonlySet<number>; onToggle: (id: number) => void };

/** Compact list view of the collection. Columns collapse on small screens. */
export function MovieTable({ movies, selection }: { movies: MovieWithCopies[]; selection?: TableSelection }) {
  const wishlist = movies[0]?.isWishlist ?? false;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-md shadow-primary/10">
      <table className="w-full text-sm">
        <thead className="bg-linear-to-r from-violet-500/10 to-fuchsia-500/10 text-left text-xs text-accent-foreground">
          <tr>
            {selection && (
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Selected</span>
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-medium">Title</th>
            <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Director</th>
            <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Formats</th>
            {!wishlist && <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Status</th>}
            <th scope="col" className="px-3 py-2 text-right font-medium">Rating</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium lg:table-cell">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {movies.map((m) => {
            const isSelected = selection?.selected.has(m.id) ?? false;
            const loanedTo = m.copies.find((c) => c.loanedTo)?.loanedTo;
            return (
              <tr
                key={m.id}
                className={cn(
                  "group relative transition-colors hover:bg-accent/60",
                  selection && "cursor-pointer select-none",
                  isSelected && "bg-accent/70",
                )}
                onClick={selection ? () => selection.onToggle(m.id) : undefined}
              >
                {selection && (
                  // The checkbox handles its own toggle; don't let the row toggle it back.
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => selection.onToggle(m.id)}
                      aria-label={`Select ${m.title}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Poster
                      src={m.posterUrl}
                      title={m.title}
                      compact
                      className="w-8 shrink-0 rounded shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/30"
                    />
                    <div className="min-w-0">
                      {selection ? (
                        <span className="font-medium">{m.title}</span>
                      ) : (
                        // Stretched link: the whole row is clickable.
                        <Link
                          href={`/movies/${m.id}`}
                          className="font-medium transition-colors outline-none group-hover:text-primary after:absolute after:inset-0 focus-visible:underline"
                        >
                          {m.title}
                        </Link>
                      )}
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
                      {loanedTo && <OnLoanBadge to={loanedTo} />}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
