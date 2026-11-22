import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MovieForm } from "@/components/movie-form";
import { Skeleton } from "@/components/ui/skeleton";
import { updateMovie } from "@/lib/actions";
import { parseIdParam } from "@/lib/params";
import { getMovie } from "@/lib/queries";
import { isTmdbConfigured } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Edit movie" };

export default function EditMoviePage({ params }: PageProps<"/movies/[id]/edit">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-gradient w-fit text-3xl font-bold tracking-tight">Edit movie</h1>
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
        <EditMovie params={params} />
      </Suspense>
    </div>
  );
}

async function EditMovie({ params }: Pick<PageProps<"/movies/[id]/edit">, "params">) {
  const id = parseIdParam((await params).id);
  const movie = await getMovie(id);
  if (!movie) notFound();

  return (
    <MovieForm
      action={updateMovie.bind(null, movie.id)}
      movie={movie}
      submitLabel="Save changes"
      cancelHref={`/movies/${movie.id}`}
      tmdbEnabled={isTmdbConfigured()}
    />
  );
}
