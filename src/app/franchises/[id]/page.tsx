import { ArrowLeftIcon, CheckCircle2Icon, HeartIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AddToWishlistButton } from "@/components/add-to-wishlist-button";
import { Poster } from "@/components/poster";
import { Skeleton } from "@/components/ui/skeleton";
import { parseIdParam } from "@/lib/params";
import { getFranchiseMovies } from "@/lib/queries";
import { getTmdbCollection, isTmdbConfigured, TmdbError, type TmdbCollection } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

export default function FranchisePage({ params }: PageProps<"/franchises/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/franchises"
        className="group inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        All franchises
      </Link>
      <Suspense fallback={<FranchiseSkeleton />}>
        <Franchise params={params} />
      </Suspense>
    </div>
  );
}

async function Franchise({ params }: Pick<PageProps<"/franchises/[id]">, "params">) {
  const collectionId = parseIdParam((await params).id);
  const mine = await getFranchiseMovies(collectionId);
  if (mine.length === 0) notFound();

  let collection: TmdbCollection | null = null;
  let error: string | null = null;
  if (isTmdbConfigured()) {
    try {
      collection = await getTmdbCollection(collectionId);
    } catch (e) {
      error = e instanceof TmdbError ? e.message : "Couldn't load this franchise from TMDB.";
    }
  } else {
    error = "TMDB isn't configured, so only the films in your vault are shown.";
  }

  const byTmdbId = new Map(mine.filter((m) => m.tmdbId).map((m) => [m.tmdbId!, m]));
  const parts = collection?.parts ?? [];
  const owned = parts.filter((p) => byTmdbId.get(p.tmdbId)?.isWishlist === false).length;
  const name = (collection?.name ?? "Franchise").replace(/ Collection$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-gradient w-fit pb-1 text-3xl font-bold tracking-tight">{name}</h1>
        {collection && (
          <>
            <p className="text-sm text-muted-foreground">
              You own {owned} of {parts.length} film{parts.length === 1 ? "" : "s"}.
            </p>
            <div
              role="meter"
              aria-label="Share of the franchise owned"
              aria-valuemin={0}
              aria-valuemax={parts.length}
              aria-valuenow={owned}
              className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-chart-track"
            >
              <div className="h-full rounded-full bg-chart-bar" style={{ width: `${(owned / Math.max(parts.length, 1)) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {collection
          ? parts.map((p) => {
              const have = byTmdbId.get(p.tmdbId);
              return (
                <li key={p.tmdbId} className="flex flex-col gap-2">
                  {have ? (
                    <Link href={`/movies/${have.id}`} className="group flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <PartPoster title={p.title} thumbUrl={p.thumbUrl} state={have.isWishlist ? "wishlist" : "owned"} />
                      <PartCaption title={p.title} year={p.releaseYear} />
                    </Link>
                  ) : (
                    <>
                      <PartPoster title={p.title} thumbUrl={p.thumbUrl} state="missing" />
                      <PartCaption title={p.title} year={p.releaseYear} />
                      <AddToWishlistButton tmdbId={p.tmdbId} title={p.title} />
                    </>
                  )}
                </li>
              );
            })
          : mine.map((m) => (
              <li key={m.id}>
                <Link href={`/movies/${m.id}`} className="font-medium hover:text-primary">
                  {m.title}
                </Link>
              </li>
            ))}
      </ul>
    </div>
  );
}

function PartPoster({ title, thumbUrl, state }: { title: string; thumbUrl: string | null; state: "owned" | "wishlist" | "missing" }) {
  return (
    <div className="relative">
      <Poster
        src={thumbUrl}
        title={title}
        className={cn(
          "rounded-xl shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-primary/25",
          state === "missing" && "opacity-45 grayscale",
        )}
      />
      {state !== "missing" && (
        <span
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shadow-md",
            state === "owned" ? "bg-emerald-600 text-white" : "bg-pink-500 text-white",
          )}
        >
          {state === "owned" ? <CheckCircle2Icon className="size-3.5" aria-hidden /> : <HeartIcon className="size-3.5" aria-hidden />}
          {state === "owned" ? "Owned" : "Wishlist"}
        </span>
      )}
      {state === "missing" && <span className="sr-only">Not in your vault</span>}
    </div>
  );
}

function PartCaption({ title, year }: { title: string; year: number | null }) {
  return (
    <div className="px-0.5">
      <p className="line-clamp-2 text-sm leading-snug font-medium transition-colors group-hover:text-primary">{title}</p>
      <p className="text-xs text-muted-foreground">{year ?? "Upcoming"}</p>
    </div>
  );
}

function FranchiseSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
