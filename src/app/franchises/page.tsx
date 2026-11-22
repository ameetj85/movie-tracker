import { LayersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { listFranchises } from "@/lib/queries";
import { isTmdbConfigured } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Franchises" };

export default function FranchisesPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-gradient w-fit text-3xl font-bold tracking-tight">Franchises</h1>
        <p className="text-sm text-muted-foreground">
          Series you own at least one film of. Open one to see which films you&apos;re missing.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
        <FranchiseList />
      </Suspense>
    </div>
  );
}

async function FranchiseList() {
  await connection();
  const franchises = await listFranchises();
  if (franchises.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-card/60 px-6 py-14 text-center">
        <LayersIcon className="size-8 text-primary" aria-hidden />
        <div>
          <h2 className="font-medium">No franchises yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Movies get their franchise from TMDB when you add them with &ldquo;Find on TMDB&rdquo;.
            {isTmdbConfigured() && (
              <>
                {" "}
                For movies already in your vault, use <Link href="/data" className="underline underline-offset-2">Refresh from TMDB</Link> on the Import &amp; export page.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {franchises.map((f) => (
        <li key={f.id}>
          <Link
            href={`/franchises/${f.id}`}
            className="group flex h-full items-center gap-3 rounded-2xl border border-primary/10 bg-card p-4 shadow-sm shadow-primary/5 transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/15 to-fuchsia-500/15 text-primary">
              <LayersIcon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium transition-colors group-hover:text-primary">
                {f.name.replace(/ Collection$/, "")}
              </span>
              <span className="text-sm text-muted-foreground">
                {f.owned} owned{f.wishlist ? ` · ${f.wishlist} on wishlist` : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
