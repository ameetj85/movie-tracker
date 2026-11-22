"use client";

import { ChevronLeftIcon, ChevronRightIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FormatBadges, Rating } from "@/components/movie-meta";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import type { MovieWithCopies } from "@/db/schema";
import { cn } from "@/lib/utils";

/** Medal colors for the top three ranks; the rest share the theme gradient. */
const RANK_STYLES = [
  "from-amber-300 to-yellow-500 text-amber-950",
  "from-slate-200 to-slate-400 text-slate-900",
  "from-orange-300 to-amber-700 text-orange-950",
];

/**
 * Horizontally scrolling, snap-aligned strip of the top-rated movies. Native
 * scrolling (touch, trackpad, Shift+wheel, keyboard) works; the arrow buttons
 * page by roughly one viewport of cards.
 */
export function TopRatedCarousel({ movies }: { movies: MovieWithCopies[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  function measure() {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }

  // Re-measure when the strip resizes (window resize, posters loading).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function page(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <section aria-labelledby="top-rated-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="top-rated-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-500 text-amber-950 shadow-md shadow-amber-500/30">
            <TrophyIcon className="size-4" aria-hidden />
          </span>
          Top {movies.length} rated
        </h2>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Scroll left" disabled={edges.start} onClick={() => page(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Scroll right" disabled={edges.end} onClick={() => page(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div className="relative">
        <ul
          ref={scroller}
          onScroll={measure}
          // `relative` makes this the containing block for the cards' sr-only
          // (absolutely positioned) text, so it's clipped instead of widening the page.
          className="relative -mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto px-1 pt-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {movies.map((m, i) => (
            <li key={m.id} className="w-36 shrink-0 snap-start sm:w-40 lg:w-44">
              <Link
                href={`/movies/${m.id}`}
                className="group flex h-full flex-col gap-2 rounded-2xl bg-card p-2 shadow-sm ring-1 shadow-primary/10 ring-primary/10 transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/25 hover:ring-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="relative">
                  <Poster
                    src={m.posterUrl}
                    title={m.title}
                    className="rounded-xl [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-105"
                  />
                  <span
                    className={cn(
                      "absolute top-1.5 left-1.5 flex size-8 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold shadow-lg ring-2 ring-white/70 tabular-nums dark:ring-black/40",
                      RANK_STYLES[i] ?? "from-violet-500 to-fuchsia-500 text-white",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1 px-1 pb-1">
                  <h3 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary" title={m.title}>
                    <span className="sr-only">Number {i + 1}: </span>
                    {m.title}
                  </h3>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{m.releaseYear ?? "—"}</span>
                    <Rating value={m.rating} className="text-xs" />
                  </div>
                  <FormatBadges formats={m.copies.map((c) => c.format)} short />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {/* Edge fades hint that there's more to scroll. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent transition-opacity",
            edges.start && "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent transition-opacity",
            edges.end && "opacity-0",
          )}
        />
      </div>
    </section>
  );
}
